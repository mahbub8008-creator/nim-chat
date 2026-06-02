export function fmtTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function truncate(text: string, maxLen = 120): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + "..."
}

export function fmtElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
}

export function fmtTps(tokens: number, seconds: number): string {
  if (seconds <= 0) return ""
  const tps = tokens / seconds
  return tps >= 10 ? `${tps.toFixed(0)} tok/s` : `${tps.toFixed(1)} tok/s`
}
