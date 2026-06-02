"use client"

import { estimateCost, formatCost } from "@/lib/cost"
import { countTokens } from "@/lib/tokens"

interface Props {
  messages: number
  inputTokens: number
  outputTokens: number
  model: string
  systemPrompt: string
  reasoningEffort: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConversationInfo({
  messages: msgCount,
  inputTokens,
  outputTokens,
  model,
  systemPrompt,
  reasoningEffort,
  open,
  onOpenChange,
}: Props) {
  if (!open) return null

  const total = inputTokens + outputTokens
  const cost = estimateCost(inputTokens, outputTokens)
  const sysTokens = countTokens(systemPrompt) + 4

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-medium text-zinc-200">Conversation Info</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <Row label="Model" value={model} />
          <Row label="Messages" value={String(msgCount)} />
          <Row label="Effort" value={reasoningEffort || "off"} />
          <Row label="Input tokens" value={`${inputTokens.toLocaleString()} (sys ~${sysTokens.toLocaleString()})`} />
          <Row label="Output tokens" value={outputTokens.toLocaleString()} />
          <Row label="Total tokens" value={total.toLocaleString()} />
          {cost > 0 && <Row label="Est. cost" value={formatCost(cost)} />}
          <div>
            <span className="text-zinc-500 text-xs">System prompt:</span>
            <p className="mt-1 text-xs text-zinc-400 italic leading-relaxed">{systemPrompt}</p>
          </div>
        </div>
        <div className="flex justify-end border-t border-zinc-800 px-5 py-4">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-200 truncate ml-4 max-w-[60%]">{value}</span>
    </div>
  )
}
