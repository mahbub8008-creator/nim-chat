"use client"

import { estimateCost, formatCost } from "@/lib/cost"


interface Props {
  inputTokens: number
  outputTokens: number
}

export function TokenBar({ inputTokens, outputTokens }: Props) {
  const total = inputTokens + outputTokens
  const cost = estimateCost(inputTokens, outputTokens)

  return (
    <div className="flex items-center justify-center gap-4 border-t border-zinc-800 px-4 py-2">
      <span className="text-xs text-zinc-600">in: ~{inputTokens.toLocaleString()}</span>
      <span className="text-xs text-zinc-600">out: ~{outputTokens.toLocaleString()}</span>
      <span className="text-xs text-zinc-600">total: ~{total.toLocaleString()}</span>
      {cost > 0 && <span className="text-xs text-zinc-600">{formatCost(cost)}</span>}
    </div>
  )
}
