import OpenAI from "openai"
import { retryWithBackoff } from "@/lib/retry"
import type { ChatMessage as LocalChatMessage, ToolCall } from "@/lib/types"

/** Shape of streamed delta chunks across NIM implementations. */
interface StreamDelta {
  reasoning?: string
  reasoning_content?: string
  thinking?: string
  content?: string
  tool_calls?: Array<{
    index?: number
    id?: string
    type?: string
    function?: { name?: string; arguments?: string }
  }>
}

// Preserve historical chat-route retry count (was 3 in the inline helper it replaced).
const MAX_RETRIES = 3

/** Tool the model can opt into for up-to-date lookups. Implementation lives on the client. */
const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "Search the web and return excerpts from relevant pages. Use this when you need current information, recent events, or facts past your training data — for example when the user asks about today's news, latest scores, recent releases, prices, or anything that may have changed. Always cite the URLs of the pages you read.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A concise search query (5-12 words). Use the user's domain-specific terms; mirror named entities, dates, or product names exactly.",
        },
      },
      required: ["query"],
    },
  },
}

const TOOLS = [WEB_SEARCH_TOOL]

function getClient() {
  return new OpenAI({
    apiKey: process.env.NIM_API_KEY || "",
    baseURL: "https://integrate.api.nvidia.com/v1",
    // Tool-calling lets the model think longer before deciding whether to call web_search.
    // 180s gives enough headroom before we surface a 504 — cancellation is the real signal we care about.
    timeout: 180_000,
    maxRetries: 0,
  })
}

export async function POST(req: Request) {
  try {
    const { model, messages, system_prompt, reasoning_effort, temperature, max_tokens, top_p } = await req.json()

    if (!model || !messages) {
      return Response.json({ error: "model and messages are required" }, { status: 400 })
    }

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    })
    // The SDK's union type for "messages" includes user content as string-or-ContentPart[],
    // assistant-with-tool_calls content as null-or-string, and tool messages with tool_call_id.
    // We type fullMessages precisely per role branch to satisfy those constraints.
    const fullMessages = buildFullMessages(messages as LocalChatMessage[], system_prompt, today)

    const client = getClient()

    // Detect whether the LATEST user message carries image content. Many NIM
    // vision models silently ignore image_url parts when `tools` is also present
    // in the request — they enter tool-calling mode and treat the turn as
    // text-only. To avoid the "I don't see an image" failure, we omit the tools
    // parameter entirely on image-bearing turns. Web search is rarely useful
    // for image questions anyway (the system prompt says to answer from the
    // image rather than searching), so this trade-off is safe.
    //
    // IMPORTANT: we check only the most recent user message, NOT all messages.
    // Images in prior turns should NOT disable web search for later text-only
    // follow-up questions.
    const lastUserMsg = [...fullMessages].reverse().find((m) => m.role === "user")
    const hasImageContent =
      !!lastUserMsg &&
      Array.isArray(lastUserMsg.content) &&
      lastUserMsg.content.some((p) => (p as { type?: string }).type === "image_url")

    const stream = await retryWithBackoff(
      () =>
        client.chat.completions.create({
          model,
          messages: fullMessages,
          stream: true,
          ...(hasImageContent ? {} : { tools: TOOLS }),
          temperature: temperature ?? 0.7,
          max_tokens: max_tokens ?? 4096,
          top_p: top_p ?? 1,
          ...(reasoning_effort ? { reasoning_effort } : {}),
        }),
      MAX_RETRIES
    )

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Accumulator for streamed tool_calls. OpenAI emits multiple deltas per
          // tool call indexed by `index`; only the FIRST delta carries id+name,
          // and later deltas only carry partial `arguments`. We assemble each
          // tool call across chunks and emit a single `tool_calls_required`
          // chunk when the model finishes a turn with finish_reason='tool_calls'.
          const toolCallsMap = new Map<number, ToolCall>()
          let finishReason: string | null = null

          for await (const chunk of stream) {
            const choice = chunk.choices?.[0]
            const delta = choice?.delta as StreamDelta | undefined

            if (delta?.reasoning || delta?.reasoning_content || delta?.thinking) {
              const text = delta.reasoning || delta.reasoning_content || delta.thinking
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "reasoning", text })}\n\n`))
            }

            if (delta?.content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", text: delta.content })}\n\n`))
            }

            if (Array.isArray(delta?.tool_calls)) {
              for (const tcDelta of delta.tool_calls) {
                // NIM always supplies `index`. If missing, drop the delta rather than collapsing
                // parallel tool calls onto slot 0.
                if (typeof tcDelta.index !== "number") continue
                const existing = toolCallsMap.get(tcDelta.index)
                if (!existing) {
                  toolCallsMap.set(tcDelta.index, {
                    id: tcDelta.id ?? "",
                    type: "function",
                    function: {
                      name: tcDelta.function?.name ?? "",
                      arguments: tcDelta.function?.arguments ?? "",
                    },
                  })
                } else {
                  if (tcDelta.id) existing.id = tcDelta.id
                  if (tcDelta.function?.name) existing.function.name = tcDelta.function.name
                  if (tcDelta.function?.arguments) {
                    existing.function.arguments += tcDelta.function.arguments
                  }
                }
              }
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason
            }
          }

          if (finishReason === "tool_calls" && toolCallsMap.size > 0) {
            const tool_calls = Array.from(toolCallsMap.values()).filter(
              (tc) => tc.id && tc.function.name
            )
            const dropped = toolCallsMap.size - tool_calls.length
            if (dropped > 0) {
              console.warn(`[chat] dropped ${dropped} malformed tool_call delta(s) (missing id or function name)`)
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "tool_calls_required", tool_calls })}\n\n`)
            )
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", text: "" })}\n\n`))
          }
          controller.close()
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stream error"
          const errorData = JSON.stringify({ type: "error", text: message })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"

    if (err && typeof err === "object" && "status" in err) {
      const status = (err as { status?: number }).status ?? 0
      if (status === 401) {
        return Response.json({ error: "Authentication failed. Check NIM_API_KEY." }, { status: 401 })
      }
      if (status === 404) {
        const modelName = (err as { url?: string }).url?.split("/").pop() || "unknown"
        return Response.json({ error: `Model "${modelName}" not found.` }, { status: 404 })
      }
      if (status === 429) {
        return Response.json({ error: "Rate limited. Please try again." }, { status: 429 })
      }
      if (status >= 500) {
        return Response.json({ error: `Server error (${status}). Please try again.` }, { status })
      }
      // Map 4xx content-type rejections on image payloads to a friendly hint.
      // NIM/OpenAI typically phrases vision-model mismatches with one of these tokens.
      if (status >= 400) {
        const lowerMessage = message.toLowerCase()
        const visionTokens = ["image", "vision", "multimodal", "image_url", "content type", "unsupported", "vlm"]
        if (visionTokens.some((token) => lowerMessage.includes(token))) {
          return Response.json(
            { error: "This model does not accept image inputs \u2014 switch to a vision-capable model from the dropdown (look for the \ud83d\udcf7 icon)." },
            { status }
          )
        }
      }
    }

    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * Project the client's ChatMessage-shaped messages into the OpenAI message-param
 * union the NIM SDK expects. Preserves tool_calls (assistant) and tool_call_id (tool),
 * and passes ContentPart[] user content unchanged so image uploads survive the round trip.
 */
function buildFullMessages(
  messages: LocalChatMessage[],
  systemPrompt: string | undefined,
  today: string
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
  if (systemPrompt) {
    fullMessages.push({ role: "system", content: `Today's date is ${today}.\n\n${systemPrompt}` })
  }

  for (const msg of messages) {
    switch (msg.role) {
      case "tool":
        fullMessages.push({
          role: "tool",
          tool_call_id: msg.tool_call_id ?? "",
          content: typeof msg.content === "string" ? msg.content : "",
        })
        break

      case "user":
        // User content may be plain text or ContentPart[] (images); pass through unchanged.
        fullMessages.push({
          role: "user",
          content: msg.content as OpenAI.Chat.ChatCompletionContentPart[] | string,
        })
        break

      case "assistant": {
        const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0
        if (hasToolCalls) {
          // OpenAI strictly expects null content when the assistant message only carries tool_calls.
          const content =
            typeof msg.content === "string" && msg.content.length > 0 ? msg.content : null
          fullMessages.push({
            role: "assistant",
            content,
            tool_calls: msg.tool_calls as OpenAI.Chat.ChatCompletionMessageToolCall[],
          })
        } else {
          fullMessages.push({
            role: "assistant",
            content: typeof msg.content === "string" ? msg.content : "",
          })
        }
        break
      }

      case "system":
        fullMessages.push({
          role: "system",
          content: typeof msg.content === "string" ? msg.content : "",
        })
        break
    }
  }

  return fullMessages
}
