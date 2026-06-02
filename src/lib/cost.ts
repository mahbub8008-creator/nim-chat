import { COST_RATES } from "./constants"

export function estimateCost(inputTokens: number, outputTokens: number): number {
  const costIn = (inputTokens / 1_000_000) * COST_RATES.input
  const costOut = (outputTokens / 1_000_000) * COST_RATES.output
  return costIn + costOut
}

export function formatCost(cost: number): string {
  if (cost < 0.0001) return "< $0.0001"
  return `$${cost.toFixed(4)}`
}
