"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { ChatMessage, ContentPart, StreamChunk, SearchResult, ToolCall } from "@/lib/types"
import { countTokens, getContentText } from "@/lib/tokens"
import { parseStream } from "@/lib/stream"
import { useLocalStorage } from "./useLocalStorage"
import { CONVERSATION_KEY, SETTINGS_KEY, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_TOP_P } from "@/lib/constants"

interface SavedConversation {
  messages: ChatMessage[]
  inputTokens: number
  outputTokens: number
}

interface ChatSettings {
  model: string
  systemPrompt: string
  reasoningEffort: string | null
  temperature: number
  maxTokens: number
  topP: number
}

interface ChatState {
  messages: ChatMessage[]
  inputTokens: number
  outputTokens: number
  isStreaming: boolean
  streamingContent: string
  streamingReasoning: string
  hasShownReasoning: boolean
  error: string | null
  isSearching: boolean
  searchContext: { query: string; sources: string[] } | null
}

// ----- Legacy prompts we want to migrate users off of -----
/** First-ever default shipped before web search existed. */
const LEGACY_DEFAULT_PROMPT =
  "You are a helpful, knowledgeable assistant. Be concise but thorough."
/** Second default: relied on a [SEARCH: ...] text marker. Replaced by tool calling. */
const LEGACY_MARKER_PROMPT = `You are a helpful, knowledgeable assistant. You have access to a web search tool to find current info, news, or verify facts.

To search the web, output exactly this marker on its own line:
[SEARCH: your query here]

RULES:
- USE SEARCH for recent events, facts past your training data, or when the user says "latest", "today", or "current".
- DO NOT USE SEARCH for casual chat, coding tasks, opinions, or general knowledge you already possess.
- FORMAT STRICTLY: Do not put brackets inside your query.
- DO NOT use the search marker as an example or casually in text.

EXAMPLES:
User: Who won the 2024 Super Bowl?
Assistant: [SEARCH: 2024 Super Bowl winner]

User: Explain how gravity works.
Assistant: Gravity is a fundamental interaction...`

// ----- Current default: native tool calling -----
const DEFAULT_PROMPT = `You are a helpful, knowledgeable assistant. You have access to a \`web_search\` function that fetches current information from the web and returns page excerpts. Use it whenever the user might benefit from up-to-date data and your training-cutoff knowledge would be unreliable or stale.

USE \`web_search\` for:
- Recent events, news, sports scores, product releases, prices, or anything time-sensitive.
- Fact-checking specific numbers, names, dates, or claims the user asks about.
- Anything that may have changed since your training cutoff.

DO NOT use \`web_search\` for:
- Casual chat, opinions, creative writing, math, coding help, or general well-known concepts.
- Anything you are already confident about.

When you use \`web_search\`, cite the URLs you read so the user can verify your answer.`

export function useChat() {
  const [settings, setSettings] = useLocalStorage<ChatSettings>(SETTINGS_KEY, {
    model: "mistralai/mistral-large-3-675b-instruct-2512",
    systemPrompt: DEFAULT_PROMPT,
    reasoningEffort: null,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    topP: DEFAULT_TOP_P,
  })

  const [state, setState] = useState<ChatState>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem(CONVERSATION_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as SavedConversation
          if (parsed.messages && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            return {
              messages: parsed.messages,
              inputTokens: parsed.inputTokens || 0,
              outputTokens: parsed.outputTokens || 0,
              isStreaming: false,
              streamingContent: "",
              streamingReasoning: "",
              hasShownReasoning: false,
              error: null,
              isSearching: false,
              searchContext: null,
            }
          }
        }
      }
    } catch { /* ignore parse errors */ }
    return {
      messages: [],
      inputTokens: 0,
      outputTokens: 0,
      isStreaming: false,
      streamingContent: "",
      streamingReasoning: "",
      hasShownReasoning: false,
      error: null,
      isSearching: false,
      searchContext: null,
    }
  })

  const abortRef = useRef<AbortController | null>(null)
  const streamStartRef = useRef<number>(0)

  useEffect(() => {
    if (state.messages.length > 0 && !state.isStreaming && !state.isSearching) {
      try {
        window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({
          messages: state.messages,
          inputTokens: state.inputTokens,
          outputTokens: state.outputTokens,
        }))
      } catch { /* quota exceeded */ }
    }
  }, [state.messages, state.inputTokens, state.outputTokens, state.isStreaming, state.isSearching])

  // Migration: anyone still on the pre-search-launch default OR on the marker-based
  // search default gets upgraded to the new tool-calling prompt. Custom prompts
  // are left alone.
  useEffect(() => {
    if (settings.systemPrompt === LEGACY_DEFAULT_PROMPT || settings.systemPrompt === LEGACY_MARKER_PROMPT) {
      setSettings((prev) => ({ ...prev, systemPrompt: DEFAULT_PROMPT }))
    }
  }, [settings.systemPrompt, setSettings])

  const streamResponse = useCallback(
    async (conversationMessages: { role: string; content: string | ContentPart[]; tool_calls?: ToolCall[] }[]) => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: settings.model,
            messages: conversationMessages,
            system_prompt: settings.systemPrompt,
            reasoning_effort: settings.reasoningEffort,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens,
            top_p: settings.topP,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Request failed (${res.status})`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

        await parseStream(
          reader,
          (chunk: StreamChunk) => {
            if (chunk.type === "tool_calls_required") {
              // Show "Searching..." spinner and hand off to the search pipeline.
              // Crucially we DO NOT commit an interim assistant message: the live
              // bubble stays visible with whatever the model streamed so far, and
              // turn 2's content appends to the same bubble via streamingContent —
              // yielding ONE coherent response per user turn.
              //
              // Snapshot captured into a module-scope var via the setState callback
              // so the value is current by the time processToolCallsAndRequery runs.
              // (streamingReasoning doesn't need its own snapshot — it stays in
              // state across both turns and accumulates naturally.)
              let snapshotContent = ""
              const firstWebSearch = chunk.tool_calls.find(
                (tc) => tc.function.name === "web_search"
              )
              const headLabel = firstWebSearch
                ? describeArgs(firstWebSearch.function.arguments)
                : "web search"
              setState((prev) => {
                snapshotContent = prev.streamingContent
                return {
                  ...prev,
                  isSearching: true,
                  searchContext: { query: headLabel, sources: [] },
                }
              })
              setTimeout(
                () =>
                  processToolCallsAndRequery(
                    conversationMessages,
                    chunk.tool_calls,
                    snapshotContent
                  ),
                0
              )
              return
            }
            if (chunk.type === "reasoning") {
              setState((prev) => ({
                ...prev,
                streamingReasoning: prev.streamingReasoning + chunk.text,
                hasShownReasoning: true,
              }))
            } else if (chunk.type === "content") {
              setState((prev) => ({
                ...prev,
                streamingContent: prev.streamingContent + chunk.text,
              }))
            }
          },
          () => {
            setState((prev) => {
              const fullContent = prev.streamingContent
              const outputTok = countTokens(fullContent) + 4
              const elapsed = (Date.now() - streamStartRef.current) / 1000
              const generationTimeMs = Date.now() - streamStartRef.current
              const tokensPerSecond = elapsed > 0 ? Math.round((outputTok / elapsed) * 10) / 10 : 0
              const assistantMessage: ChatMessage = {
                role: "assistant",
                content: fullContent,
                reasoning: prev.streamingReasoning || undefined,
                timestamp: Date.now(),
                tokensPerSecond,
                generationTimeMs,
                ...(prev.searchContext?.sources?.length
                  ? { sources: prev.searchContext.sources }
                  : {}),
              }
              return {
                ...prev,
                messages: [...prev.messages, assistantMessage],
                outputTokens: prev.outputTokens + outputTok,
                isStreaming: false,
                streamingContent: "",
                streamingReasoning: "",
                hasShownReasoning: false,
                // Detach searchContext from this turn so stale sources from a prior
                // web_search don't bleed onto the next assistant message.
                searchContext: null,
              }
            })
            abortRef.current = null
          },
          (err: Error) => {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              streamingContent: "",
              streamingReasoning: "",
              hasShownReasoning: false,
              error: err.message,
              // Detach searchContext so stale sources from a prior search don't
              // bleed onto the next assistant message.
              searchContext: null,
            }))
            abortRef.current = null
          },
          controller.signal
        )
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            streamingContent: "",
            streamingReasoning: "",
            // Detach any leftover search context from a tool turn that got cancelled.
            searchContext: null,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: err instanceof Error ? err.message : "Request failed",
            // Detach so a failed tool turn doesn't pollute the next assistant message.
            searchContext: null,
          }))
        }
        abortRef.current = null
      }
    },
    // processToolCallsAndRequery is intentionally captured via closure; updating the
    // dep list creates a circular memoization loop (it depends on streamResponse, which
    // depends on this closure to set up the re-prompt).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings]
  )

  const processToolCallsAndRequery = useCallback(
    async (
      originalMessages: { role: string; content: string | ContentPart[]; tool_calls?: ToolCall[] }[],
      toolCalls: ToolCall[],
      partialContent: string
    ) => {
      // Reuse the stream's AbortController so cancelStream() also cancels these fetches.
      const signal = abortRef.current?.signal

      const toolMessages: { role: "tool"; tool_call_id: string; content: string }[] = []
      const allSources: string[] = []
      const allQueries: string[] = []

      try {
        for (const tc of toolCalls) {
          if (tc.function.name !== "web_search") {
            toolMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Tool "${tc.function.name}" is not supported in this environment.`,
            })
            continue
          }

          const args = parseArgs(tc.function.arguments)
          const query = typeof args.query === "string" ? args.query.trim() : ""
          if (!query) {
            toolMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: "No query was provided to web_search.",
            })
            continue
          }

          allQueries.push(query)
          // Update indicator to show the most recent query when multiple searches run.
          setState((prev) => ({
            ...prev,
            searchContext: { query, sources: prev.searchContext?.sources ?? [] },
          }))

          try {
            const text = await runWebSearch(query, signal)
            toolMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: text.content,
            })
            // Sources accumulate so the final assistant message can cite them.
            if (text.url) allSources.push(text.url)
            setState((prev) => ({
              ...prev,
              searchContext: {
                query,
                sources: [...(prev.searchContext?.sources ?? []), ...(text.url ? [text.url] : [])],
              },
            }))
          } catch (e) {
            if ((e as Error).name === "AbortError") throw e
            toolMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Search failed: ${(e as Error).message}`,
            })
          }
        }

        // Synthesize an assistant(tool_calls) message + the tool results so the model
        // sees its own prior turn. We DO NOT commit this synthesized message to
        // state.messages — the live bubble keeps showing partialContent and turn 2's
        // tokens append via streamingContent, yielding ONE bubble per user turn.
        const newMessages: typeof originalMessages = [
          ...originalMessages,
          {
            role: "assistant" as const,
            content: partialContent,
            tool_calls: toolCalls,
          },
          ...toolMessages,
        ]

        // Honor an abort that landed in the microsecond window between search
        // completion and streamResponse init (don't replace abortRef).
        if (signal?.aborted) {
          const e = new Error("aborted")
          ;(e as Error).name = "AbortError"
          throw e
        }

        streamStartRef.current = Date.now()
        setState((prev) => ({
          ...prev,
          isStreaming: true,
          // KEEP streamingContent / streamingReasoning — they're the first half of
          // the single visible bubble. They keep growing while turn 2 streams.
          isSearching: false,
          // Keep searchContext with sources so the final onDone can attach them.
          searchContext: prev.searchContext ?? { query: allQueries[0] ?? "", sources: allSources },
        }))

        await streamResponse(newMessages)
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            isSearching: false,
            searchContext: null,
            streamingContent: "",
            streamingReasoning: "",
          }))
          return
        }
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isSearching: false,
          searchContext: null,
          streamingContent: "",
          streamingReasoning: "",
          error: err instanceof Error ? err.message : "Search & re-query failed",
        }))
      } finally {
        if (abortRef.current?.signal.aborted) {
          abortRef.current = null
        }
      }
    },
    [streamResponse]
  )

  const sendMessage = useCallback(
    async (text: string, images?: string[]) => {
      const hasImages = !!(images && images.length > 0)

      let content: string | ContentPart[]
      if (hasImages) {
        const parts: ContentPart[] = []
        if (text.trim()) {
          parts.push({ type: "text", text })
        }
        for (const img of images!) {
          parts.push({ type: "image_url", image_url: { url: img, detail: "auto" } })
        }
        content = parts
      } else {
        if (!text.trim() || state.isStreaming) return
        content = text
      }

      const messageTokens = countTokens(getContentText(content)) + 4
      const userMessage: ChatMessage = { role: "user", content, timestamp: Date.now() }

      streamStartRef.current = Date.now()

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        inputTokens: prev.inputTokens + messageTokens,
        isStreaming: true,
        streamingContent: "",
        streamingReasoning: "",
        hasShownReasoning: false,
        error: null,
        isSearching: false,
        searchContext: null,
      }))

      const conversationMessages = [...state.messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      }))

      await streamResponse(conversationMessages)
    },
    [state.messages, state.isStreaming, streamResponse]
  )

  const editAndResend = useCallback(
    async (index: number, newContent: string) => {
      if (!newContent.trim() || state.isStreaming) return

      const truncatedMessages = state.messages.slice(0, index)

      let newInputTokens = 0
      let newOutputTokens = 0
      for (const msg of truncatedMessages) {
        if (msg.role === "user") {
          newInputTokens += countTokens(getContentText(msg.content)) + 4
        } else {
          newOutputTokens += countTokens(getContentText(msg.content)) + 4
        }
      }

      const messageTokens = countTokens(newContent) + 4
      const userMessage: ChatMessage = { role: "user", content: newContent, timestamp: Date.now() }

      streamStartRef.current = Date.now()

      setState((prev) => ({
        ...prev,
        messages: [...truncatedMessages, userMessage],
        inputTokens: newInputTokens + messageTokens,
        outputTokens: newOutputTokens,
        isStreaming: true,
        streamingContent: "",
        streamingReasoning: "",
        hasShownReasoning: false,
        error: null,
        isSearching: false,
        searchContext: null,
      }))

      const conversationMessages = truncatedMessages.concat(userMessage).map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      }))

      await streamResponse(conversationMessages)
    },
    [state.messages, state.isStreaming, streamResponse]
  )

  const cancelStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearConversation = useCallback(() => {
    abortRef.current?.abort()
    try {
      window.localStorage.removeItem(CONVERSATION_KEY)
    } catch { /* ignore */ }
    setState({
      messages: [],
      inputTokens: 0,
      outputTokens: 0,
      isStreaming: false,
      streamingContent: "",
      streamingReasoning: "",
      hasShownReasoning: false,
      error: null,
      isSearching: false,
      searchContext: null,
    })
  }, [])

  const exportConversation = useCallback(() => {
    const data = {
      model: settings.model,
      system_prompt: settings.systemPrompt,
      messages: state.messages,
      reasoning_effort: settings.reasoningEffort,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      top_p: settings.topP,
      input_tokens: state.inputTokens,
      output_tokens: state.outputTokens,
      exported_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `nim-chat-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [settings, state])

  const setModel = useCallback(
    (model: string) => setSettings((prev) => ({ ...prev, model })),
    [setSettings]
  )

  const setSystemPrompt = useCallback(
    (prompt: string) => setSettings((prev) => ({ ...prev, systemPrompt: prompt })),
    [setSettings]
  )

  const setReasoningEffort = useCallback(
    (effort: string | null) => setSettings((prev) => ({ ...prev, reasoningEffort: effort })),
    [setSettings]
  )

  const setTemperature = useCallback(
    (temperature: number) => setSettings((prev) => ({ ...prev, temperature })),
    [setSettings]
  )

  const setMaxTokens = useCallback(
    (maxTokens: number) => setSettings((prev) => ({ ...prev, maxTokens })),
    [setSettings]
  )

  const setTopP = useCallback(
    (topP: number) => setSettings((prev) => ({ ...prev, topP })),
    [setSettings]
  )

  return {
    ...state,
    settings,
    sendMessage,
    editAndResend,
    cancelStream,
    clearConversation,
    exportConversation,
    setModel,
    setSystemPrompt,
    setReasoningEffort,
    setTemperature,
    setMaxTokens,
    setTopP,
  }
}

// ----- helpers (module-scoped, no closure state) -----

/** Run a search + extract + synthesize tool result text. */
async function runWebSearch(
  query: string,
  signal?: AbortSignal
): Promise<{ content: string; url?: string }> {
  const searchRes = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: 5 }),
    ...(signal ? { signal } : {}),
  })
  if (!searchRes.ok) throw new Error("Search failed")
  const searchData = await searchRes.json()
  const results: SearchResult[] = searchData.results || []
  const bestUrl = results[0]?.href

  let pageContent = ""
  if (bestUrl) {
    const extRes = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: bestUrl }),
      ...(signal ? { signal } : {}),
    })
    if (extRes.ok) {
      const extData = await extRes.json()
      pageContent = typeof extData.content === "string" ? extData.content : ""
    }
  }

  if (!bestUrl) {
    return { content: `No web results found for: ${query}` }
  }
  if (!pageContent) {
    return {
      content: `Source: ${bestUrl}\n(Unable to extract page content. Summarize from the URL itself.)`,
      url: bestUrl,
    }
  }
  return {
    content: `Source: ${bestUrl}\n${pageContent}`,
    url: bestUrl,
  }
}

/** Parse a streamed arguments JSON string; tolerate partial / malformed input. */
function parseArgs(args: string | undefined): Record<string, unknown> {
  if (!args) return {}
  try {
    const parsed = JSON.parse(args)
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Format function arguments into a short label for the "Searching..." indicator. */
function describeArgs(args: string | undefined): string {
  const parsed = parseArgs(args)
  const q = parsed.query
  return typeof q === "string" ? q : ""
}
