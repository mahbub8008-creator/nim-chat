import { retryWithBackoff } from "@/lib/retry"

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== "string") {
      return Response.json({ error: "url required" }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return Response.json({ error: "Invalid URL" }, { status: 400 })
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return Response.json({ error: "Only http(s) URLs are allowed" }, { status: 400 })
    }

    // Shared deadline so retries share a 20s budget instead of N × 15s stacking
    // past Render's request-level timeout.
    const budgetMs = 20_000
    const deadline = Date.now() + budgetMs
    const res = await retryWithBackoff(() => {
      const remaining = Math.max(1000, deadline - Date.now())
      return fetch(parsed.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NimChat/1.0; +https://github.com)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(remaining),
        redirect: "follow",
      })
    }, 2)

    if (!res.ok) {
      return Response.json({ error: `Fetch failed with status ${res.status}` }, { status: 502 })
    }

    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
      return Response.json({ error: `Unsupported content-type: ${contentType}` }, { status: 415 })
    }

    const html = await res.text()
    const content = htmlToText(html).slice(0, 15000)
    return Response.json({ url, content })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Extraction failed"
    return Response.json({ error: msg }, { status: 500 })
  }
}

/** Lightweight HTML-to-text extractor — strips scripts/styles/tags and decodes key entities. */
function htmlToText(html: string): string {
  let text = html
    // Drop script/style/noscript blocks wholesale
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    // Drop opening self-closing-only structural tags
    .replace(/<\/?(head|meta|link|nav|header|footer|aside|iframe|form|button|input|noscript|svg)\b[^>]*>/gi, "")

  // Block-level closers → newline
  text = text.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/td|\/th|\/article|\/section)\b[^>]*>/gi, "\n")

  // Open a paragraph on its own line
  text = text.replace(/<p\b[^>]*>/gi, "\n")

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "")

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, "")

  // Collapse whitespace
  text = text
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return text
}
