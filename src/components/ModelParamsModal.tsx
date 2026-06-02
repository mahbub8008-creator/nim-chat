"use client"

import { useState } from "react"
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_TOP_P } from "@/lib/constants"

interface Props {
  temperature: number
  maxTokens: number
  topP: number
  onSave: (params: { temperature: number; maxTokens: number; topP: number }) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModelParamsModal({ temperature, maxTokens, topP, onSave, open, onOpenChange }: Props) {
  const [temp, setTemp] = useState(temperature)
  const [tokens, setTokens] = useState(maxTokens)
  const [p, setP] = useState(topP)

  if (!open) return null

  const handleSave = () => {
    onSave({ temperature: temp, maxTokens: tokens, topP: p })
    onOpenChange(false)
  }

  const handleReset = () => {
    setTemp(DEFAULT_TEMPERATURE)
    setTokens(DEFAULT_MAX_TOKENS)
    setP(DEFAULT_TOP_P)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-medium text-zinc-200">Model Parameters</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 p-5">
          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Temperature</label>
              <span className="text-sm font-mono text-emerald-400 tabular-nums">{temp.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temp}
              onChange={(e) => setTemp(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-zinc-600">Precise (0)</span>
              <span className="text-xs text-zinc-600">Creative (2)</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Controls randomness. Lower values make output more deterministic, higher values more varied.
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Max Tokens</label>
              <span className="text-sm font-mono text-emerald-400 tabular-nums">{tokens.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="64"
              max="16384"
              step="64"
              value={tokens}
              onChange={(e) => setTokens(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-zinc-600">64</span>
              <span className="text-xs text-zinc-600">16,384</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Maximum number of tokens the model can generate in a single response.
            </p>
          </div>

          {/* Top P */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Top P</label>
              <span className="text-sm font-mono text-emerald-400 tabular-nums">{p.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={p}
              onChange={(e) => setP(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-zinc-600">Focused (0)</span>
              <span className="text-xs text-zinc-600">Diverse (1)</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Nucleus sampling. Controls the cumulative probability threshold for token selection.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-4">
          <button
            onClick={handleReset}
            className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
