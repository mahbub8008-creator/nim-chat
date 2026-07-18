"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { ChatMessage, ContentPart, StreamChunk, SearchResult } from "@/lib/types"
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

/** Used by both the initial loader and the migration effect below. */
const OLD_DEFAULT_PROMPT =
  "You are a helpful, knowledgeable assistant. Be concise but thorough."

/** Default system prompt shipped to fresh users, and migrated onto for users still on the old default. */
const NEW_DEFAULT_PROMPT = `You are a helpful, knowledgeable assistant. You have access to a web search tool to find current info, news, or verify facts.

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

// Unanchored + bracket-safe: catches markers mid-stream and won't swallow closing ].
const SEARCH_RE = /\[SEARCH:\s*([^\]]+?)\s*\]/

export function useChat() {
  const [settings, setSettings] = useLocalStorage<ChatSettings>(SETTINGS_KEY, {
    model: "mistralai/mistral-large-3-675b-instruct-2512",
    systemPrompt: NEW_DEFAULT_PROMPT,
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

  // Surgical migration: users still on the pre-search-launch default prompt get
  // upgraded to the new search-instructed default, while users who already
  // customized their prompt are left alone. Preserves model, reasoningEffort,
  // temperature, maxTokens, topP — only the systemPrompt text is updated.
  // Calls setSettings directly (declared above) so we don't forward-reference
  // `setSystemPrompt` which is defined later in this function.
  useEffect(() => {
    if (settings.systemPrompt === OLD_DEFAULT_PROMPT) {
      setSettings((prev) => ({ ...prev, systemPrompt: NEW_DEFAULT_PROMPT }))
    }
  }, [settings.systemPrompt, setSettings])

  const update = useCallback((partial: Partial<ChatState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  const streamResponse = useCallback(
    async (conversationMessages: { role: string; content: string | ContentPart[] }[]) => {
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
              const match = fullContent.match(SEARCH_RE)

              if (match) {
                // AI requested a web search — don't add marker as message.
                // Keep abortRef.current alive so cancelStream() also aborts the search fetches.
                const query = match[1]
                // Trigger search cycle asynchronously
                setTimeout(() => searchAndRequery(conversationMessages, query), 0)
                return {
                  ...prev,
                  isSearching: true,
                  searchContext: { query, sources: [] },
                  isStreaming: false,
                  streamingContent: "",
                  streamingReasoning: "",
                  hasShownReasoning: false,
                }
              }

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
              }
              return {
                ...prev,
                messages: [...prev.messages, assistantMessage],
                outputTokens: prev.outputTokens + outputTok,
                isStreaming: false,
                streamingContent: "",
                streamingReasoning: "",
                hasShownReasoning: false,
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
              error: err.message,
            }))
            abortRef.current = null
          },
          controller.signal
        )
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState((prev) => {
            const fullContent = prev.streamingContent
            const outputTok = countTokens(fullContent) + 4
            const elapsed = (Date.now() - streamStartRef.current) / 1000
            const generationTimeMs = Date.now() - streamStartRef.current
            const tokensPerSecond = elapsed > 0 && outputTok > 0 ? Math.round((outputTok / elapsed) * 10) / 10 : 0
            const assistantMessage: ChatMessage = {
              role: "assistant",
              content: fullContent || "",
              reasoning: prev.streamingReasoning || undefined,
              timestamp: Date.now(),
              ...(fullContent ? { tokensPerSecond, generationTimeMs } : {}),
            }
            return {
              ...prev,
              messages: fullContent ? [...prev.messages, assistantMessage] : prev.messages,
              outputTokens: prev.outputTokens + (fullContent ? outputTok : 0),
              isStreaming: false,
              streamingContent: "",
              streamingReasoning: "",
            }
          })
        } else {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            error: err instanceof Error ? err.message : "Request failed",
          }))
        }
        abortRef.current = null
      }
    },
    [settings]
  )

  const searchAndRequery = useCallback(
    async (originalMessages: { role: string; content: string | ContentPart[] }[], query: string) => {
      // Reuse the stream's AbortController so cancelStream() also cancels these fetches.
      const signal = abortRef.current?.signal
      try {
        const searchRes = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, max_results: 5 }),
          ...(signal ? { signal } : {}),
        })
        if (!searchRes.ok) {
          throw new Error("Search failed")
        }
        const searchData = await searchRes.json()
        const results: SearchResult[] = searchData.results || []

        // Extract only the BEST-matching URL (DDG's top-ranked result).
        const bestUrl = results[0]?.href
        const parts: string[] = []

        if (bestUrl) {
          try {
            const extRes = await fetch("/api/extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: bestUrl }),
              ...(signal ? { signal } : {}),
            })
            if (extRes.ok) {
              const extData = await extRes.json()
              if (extData.content) {
                parts.push(`Source: ${bestUrl}\n${extData.content}`)
                // Accumulate sources via prev state to fix the closure bug.
                setState((prev) => ({
                  ...prev,
                  searchContext: {
                    query,
                    sources: [...(prev.searchContext?.sources || []), bestUrl],
                  },
                }))
              }
            }
          } catch (e) {
            // Rethrow aborts so the outer catch can handle them silently.
            if ((e as Error).name === "AbortError") throw e
          }
        }

        const searchContext = parts.length > 0 ? parts.join("\n\n---\n\n") : null

        // Build new conversation messages: pop last user message, re-add with separate context injection.
        const popMsg = originalMessages.pop()

        const newMessages = [
          ...originalMessages,
          ...(searchContext
            ? [{ role: "user" as const, content: `[WEB SEARCH RESULT]\n${searchContext}` }]
            : []),
          ...(popMsg ? [popMsg] : []),
        ]

        // Honor an abort that landed in the microsecond window between search completion
        // and streamResponse init (otherwise streamResponse would replace abortRef and the
        // user's cancel intent would be lost).
        if (signal?.aborted) {
          const e = new Error("aborted")
          ;(e as Error).name = "AbortError"
          throw e
        }

        streamStartRef.current = Date.now()
        setState((prev) => ({
          ...prev,
          isStreaming: true,
          streamingContent: "",
          streamingReasoning: "",
          hasShownReasoning: false,
          isSearching: false,
        }))

        await streamResponse(newMessages)
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          // Silent cancel: user pressed Stop mid-search. Don't show error banner.
          setState((prev) => ({
            ...prev,
            isSearching: false,
            searchContext: null,
            streamingContent: "",
            streamingReasoning: "",
          }))
          return
        }
        setState((prev) => ({
          ...prev,
          isSearching: false,
          searchContext: null,
          error: err instanceof Error ? err.message : "Search & re-query failed",
        }))
      } finally {
        // If this controller was aborted, clear the ref so future requests start clean.
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

      const conversationMessages = [...truncatedMessages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
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
