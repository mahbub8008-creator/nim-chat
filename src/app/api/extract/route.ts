import { ddgExtract, DDGUpstreamError } from "@/lib/ddg"

const EXTRACT_FORMATS = ["text_markdown", "text_plain", "text_rich", "text", "content"] as const
type ExtractFormat = (typeof EXTRACT_FORMATS)[number]

function isExtractFormat(value: unknown): value is ExtractFormat {
  return typeof value === "string" && (EXTRACT_FORMATS as readonly string[]).includes(value)
}

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

    const format: ExtractFormat = isExtractFormat(body?.format) ? body.format : "text_markdown"

    const content = await ddgExtract(url, { format })

    return Response.json({ url, content })
  } catch (err: unknown) {
    if (err instanceof DDGUpstreamError) {
      const status = err.status === 429 ? 429 : 502
      return Response.json({ error: err.message }, { status })
    }
    const msg = err instanceof Error ? err.message : "Extraction failed"
    return Response.json({ error: msg }, { status: 500 })
  }
}
