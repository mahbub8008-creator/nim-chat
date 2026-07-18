import OpenAI from "openai"
import { retryWithBackoff } from "@/lib/retry"

// Preserve historical chat-route retry count (was 3 in the inline helper it replaced).
const MAX_RETRIES = 3

function getClient() {
  return new OpenAI({
    apiKey: process.env.NIM_API_KEY || "",
    baseURL: "https://integrate.api.nvidia.com/v1",
    timeout: 60_000,
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
    const fullMessages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[] = []
    if (system_prompt) {
      fullMessages.push({ role: "system", content: `Today's date is ${today}.\n\n${system_prompt}` })
    }

    // Map messages — if content is already an array (multimodal), pass it through
    for (const msg of messages) {
      fullMessages.push({
        role: msg.role,
        content: msg.content,
      })
    }

    const client = getClient()

    const stream = await retryWithBackoff(
      () =>
        client.chat.completions.create({
          model,
          messages: fullMessages as any,
          stream: true,
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
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta
            if (!delta) continue

            const reasoningContent =
              (delta as any).reasoning ||
              (delta as any).reasoning_content ||
              (delta as any).thinking

            if (reasoningContent) {
              const data = JSON.stringify({ type: "reasoning", text: reasoningContent })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }

            if (delta.content) {
              const data = JSON.stringify({ type: "content", text: delta.content })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", text: "" })}\n\n`))
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
      const status = (err as any).status
      if (status === 401) {
        return Response.json({ error: "Authentication failed. Check NIM_API_KEY." }, { status: 401 })
      }
      if (status === 404) {
        const modelName = (err as any).url?.split("/").pop() || "unknown"
        return Response.json({ error: `Model "${modelName}" not found.` }, { status: 404 })
      }
      if (status === 429) {
        return Response.json({ error: "Rate limited. Please try again." }, { status: 429 })
      }
      if (status >= 500) {
        return Response.json({ error: `Server error (${status}). Please try again.` }, { status })
      }
    }

    return Response.json({ error: message }, { status: 500 })
  }
}
