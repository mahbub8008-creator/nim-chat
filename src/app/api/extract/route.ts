import { retryWithBackoff } from "@/lib/retry"

// Same const as search/route.ts — copy this if you self-host DDGS.
const DDGS_BASE = "https://ddgs.vercel.app"
const EXTRACT_BUDGET_MS = 25_000 // shared budget across retries (per-attempt timeout = remaining)
const EXTRACT_MAX_CHARS = 20_000

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const url = typeof body?.url === "string" ? body.url : ""
    if (!url) {
      return Response.json({ error: "url required" }, { status: 400 })
    }

    // Validate URL is http(s) only.
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return Response.json({ error: "Invalid URL" }, { status: 400 })
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return Response.json({ error: "Only http(s) URLs are allowed" }, { status: 400 })
    }

    const format = ["text_markdown", "text_plain", "text_rich", "text", "content"].includes(
      String(body?.format)
    )
      ? String(body.format)
      : "text_markdown"

    const deadline = Date.now() + EXTRACT_BUDGET_MS
    const res = await retryWithBackoff(() => {
      const remaining = Math.max(1000, deadline - Date.now())
      return fetch(`${DDGS_BASE}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format }),
        signal: AbortSignal.timeout(remaining),
      })
    }, 2)

    if (res.status === 422) {
      return Response.json({ error: "Extract upstream rejected the URL." }, { status: 502 })
    }
    if (res.status === 403) {
      return Response.json({ error: "Extract blocked by upstream server." }, { status: 502 })
    }
    if (res.status === 429) {
      return Response.json({ error: "Extract rate-limited. Please try again shortly." }, { status: 429 })
    }
    if (!res.ok) {
      return Response.json({ error: `Extract upstream failed (${res.status}).` }, { status: 502 })
    }

    const data = await res.json().catch(() => ({}))
    const content = typeof data?.content === "string" ? data.content : ""

    return Response.json({ url, content: content.slice(0, EXTRACT_MAX_CHARS) })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Extraction failed"
    return Response.json({ error: msg }, { status: 500 })
  }
}
