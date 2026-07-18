import { retryWithBackoff } from "@/lib/retry"

// Change DDGS_BASE to your self-hosted DDGS endpoint if the public one becomes
// unreliable. No env var needed for the public instance.
const DDGS_BASE = "https://ddgs.vercel.app"
const SEARCH_TIMEOUT_MS = 15_000

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body?.query === "string" ? body.query.trim() : ""
    if (!query) {
      return Response.json({ error: "query required" }, { status: 400 })
    }
    const maxRes = Math.min(Math.max(Number(body?.max_results) || 5, 1), 10)

    const res = await retryWithBackoff(
      () =>
        fetch(`${DDGS_BASE}/search/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            max_results: maxRes,
            ...(body?.region ? { region: String(body.region) } : {}),
            ...(body?.safesearch ? { safesearch: String(body.safesearch) } : {}),
            ...(body?.timelimit ? { timelimit: String(body.timelimit) } : {}),
            ...(body?.backend ? { backend: String(body.backend) } : {}),
          }),
          signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
        }),
      2
    )

    if (res.status === 422) {
      return Response.json({ error: "Search upstream rejected the query." }, { status: 502 })
    }
    if (res.status === 403) {
      return Response.json({ error: "Search blocked by upstream server." }, { status: 502 })
    }
    if (res.status === 429) {
      return Response.json({ error: "Search rate-limited. Please try again shortly." }, { status: 429 })
    }
    if (!res.ok) {
      return Response.json({ error: `Search upstream failed (${res.status}).` }, { status: 502 })
    }

    const data = await res.json().catch(() => ({}))
    const rawResults = Array.isArray(data?.results) ? data.results : []

    return Response.json({
      results: rawResults.slice(0, maxRes).map((r: any) => ({
        title: r.title ?? "",
        href: r.href ?? r.url ?? "",
        body: r.body ?? r.snippet ?? r.description ?? "",
      })),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Search failed"
    return Response.json({ error: msg }, { status: 500 })
  }
}
