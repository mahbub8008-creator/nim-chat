import { search, SafeSearchType } from "duck-duck-scrape"
import { retryWithBackoff } from "@/lib/retry"

export async function POST(req: Request) {
  try {
    const { query, max_results } = await req.json()
    if (!query || typeof query !== "string") {
      return Response.json({ error: "query required" }, { status: 400 })
    }

    const maxRes = Math.min(Math.max(max_results ?? 5, 1), 10)
    const data = await retryWithBackoff(
      () => search(query, { safeSearch: SafeSearchType.MODERATE }),
      2
    )

    return Response.json({
      results: (data.results || []).slice(0, maxRes).map((r: any) => ({
        title: r.title ?? "",
        href: r.url ?? "",
        body: r.snippet ?? r.description ?? "",
      })),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Search failed"
    return Response.json({ error: msg }, { status: 500 })
  }
}
