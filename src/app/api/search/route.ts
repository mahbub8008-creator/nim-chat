import { ddgSearch, DDGUpstreamError } from "@/lib/ddg"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body?.query === "string" ? body.query.trim() : ""
    if (!query) {
      return Response.json({ error: "query required" }, { status: 400 })
    }

    const results = await ddgSearch(query, {
      max_results: Number(body?.max_results) || 5,
      ...(body?.region ? { region: String(body.region) } : {}),
      ...(body?.safesearch ? { safesearch: String(body.safesearch) } : {}),
      ...(body?.timelimit ? { timelimit: String(body.timelimit) } : {}),
      ...(body?.backend ? { backend: String(body.backend) } : {}),
    })

    return Response.json({ results })
  } catch (err: unknown) {
    if (err instanceof DDGUpstreamError) {
      const status = err.status === 429 ? 429 : 502
      return Response.json({ error: err.message }, { status })
    }
    const msg = err instanceof Error ? err.message : "Search failed"
    return Response.json({ error: msg }, { status: 500 })
  }
}
