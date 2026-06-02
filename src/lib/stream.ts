import type { StreamChunk } from "./types"

export async function parseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (chunk: StreamChunk) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal?: AbortSignal
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      if (signal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith("data: ")) continue

        const data = trimmed.slice(6)
        if (data === "[DONE]") {
          onDone()
          return
        }

        try {
          const parsed = JSON.parse(data) as StreamChunk
          onChunk(parsed)
          if (parsed.type === "error") {
            onError(new Error(parsed.text))
            return
          }
        } catch {
          continue
        }
      }
    }

    if (!signal?.aborted) onDone()
  } catch (err) {
    if (!signal?.aborted) onError(err instanceof Error ? err : new Error(String(err)))
  }
}
