import { retryWithBackoff } from "@/lib/retry"
import type { SearchResult } from "@/lib/types"

interface DDGRawResult {
  title?: string
  href?: string
  url?: string
  body?: string
  snippet?: string
  description?: string
}

// Self-host DDGS if the public one becomes unreliable and update this constant;
// no env var needed for the public instance.
const DDGS_BASE = "https://ddgs.vercel.app"
export const SEARCH_TIMEOUT_MS = 15_000
export const EXTRACT_BUDGET_MS = 25_000 // shared budget across retries (per-attempt timeout = remaining)
export const EXTRACT_MAX_CHARS = 20_000

export class DDGUpstreamError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = "DDGUpstreamError"
  }
}

export interface SearchOptions {
  max_results?: number
  region?: string
  safesearch?: string
  timelimit?: string
  backend?: string
}

/** POST to DDGS text search and return a normalized list of results. */
export async function ddgSearch(
  query: string,
  opts: SearchOptions = {},
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const maxRes = Math.min(Math.max(opts.max_results ?? 5, 1), 10)
  const res = await retryWithBackoff(
    () =>
      fetch(`${DDGS_BASE}/search/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          max_results: maxRes,
          ...(opts.region ? { region: String(opts.region) } : {}),
          ...(opts.safesearch ? { safesearch: String(opts.safesearch) } : {}),
          ...(opts.timelimit ? { timelimit: String(opts.timelimit) } : {}),
          ...(opts.backend ? { backend: String(opts.backend) } : {}),
        }),
        signal: composeSignal(signal, SEARCH_TIMEOUT_MS),
      }),
    2
  )

  if (res.status === 422) throw new DDGUpstreamError("Search upstream rejected the query.", 422)
  if (res.status === 403) throw new DDGUpstreamError("Search blocked by upstream server.", 403)
  if (res.status === 429) throw new DDGUpstreamError("Search rate-limited. Please try again shortly.", 429)
  if (!res.ok) throw new DDGUpstreamError(`Search upstream failed (${res.status}).`, res.status)

  const data = await res.json().catch(() => ({}))
  const rawResults = Array.isArray(data?.results) ? data.results : []

  return rawResults.slice(0, maxRes).map((r: DDGRawResult) => ({
    title: r.title ?? "",
    href: r.href ?? r.url ?? "",
    body: r.body ?? r.snippet ?? r.description ?? "",
  }))
}

export interface ExtractOptions {
  format?: "text_markdown" | "text_plain" | "text_rich" | "text" | "content"
}

/** POST to DDGS extract and return the page content (capped at EXTRACT_MAX_CHARS). */
export async function ddgExtract(
  url: string,
  opts: ExtractOptions = {},
  signal?: AbortSignal
): Promise<string> {
  const format = [
    "text_markdown",
    "text_plain",
    "text_rich",
    "text",
    "content",
  ].includes(String(opts.format))
    ? String(opts.format)
    : "text_markdown"

  const deadline = Date.now() + EXTRACT_BUDGET_MS
  const res = await retryWithBackoff(() => {
    const remaining = Math.max(1000, deadline - Date.now())
    return fetch(`${DDGS_BASE}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format }),
      signal: composeBudgetSignal(signal, remaining),
    })
  }, 2)

  if (res.status === 422) throw new DDGUpstreamError("Extract upstream rejected the URL.", 422)
  if (res.status === 403) throw new DDGUpstreamError("Extract blocked by upstream server.", 403)
  if (res.status === 429) throw new DDGUpstreamError("Extract rate-limited. Please try again shortly.", 429)
  if (!res.ok) throw new DDGUpstreamError(`Extract upstream failed (${res.status}).`, res.status)

  const data = await res.json().catch(() => ({}))
  const content = typeof data?.content === "string" ? data.content : ""
  return content.slice(0, EXTRACT_MAX_CHARS)
}

/**
 * Compose the user's signal with a hard timeout. Either path triggers abort.
 * `AbortSignal.any` is available in Node 20+.
 */
function composeSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/** Like composeSignal, but uses a remaining-budget timeout that shrinks across retries. */
function composeBudgetSignal(signal: AbortSignal | undefined, remainingMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(remainingMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}
