/** Retry an async function with exponential backoff, preserving the last error. */
export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt))
        continue
      }
    }
  }
  throw lastError
}

/** Sleep helper used between retry attempts. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Exponential backoff in ms: 300ms, 600ms, 1.2s, 2.4s, capped at 4s. */
function backoffMs(attempt: number): number {
  return Math.min(300 * 2 ** attempt, 4000)
}
