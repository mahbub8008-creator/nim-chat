"use client"

import type { ModelInfo } from "@/lib/types"

interface Props {
  currentModel: string
  models: ModelInfo[]
  paidModels: ModelInfo[]
  freeModels: ModelInfo[]
  loading: boolean
  onSelect: (model: string) => void
  onRefresh: () => void
}

export function ModelSelector({ currentModel, models, paidModels, freeModels, loading, onSelect, onRefresh }: Props) {
  const renderOption = (m: ModelInfo) => (
    <option key={m.id} value={m.id}>
      {m.id}{m.supports_vision ? " 📷" : ""}
    </option>
  )

  return (
    <div className="relative group">
      <div className="flex items-center gap-2">
        <select
          value={currentModel}
          onChange={(e) => onSelect(e.target.value)}
          className="max-w-[220px] truncate rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-300 outline-none ring-1 ring-zinc-700 focus:ring-emerald-500 cursor-pointer"
        >
          {models.length === 0 && <option value={currentModel}>{currentModel}</option>}
          {paidModels.length > 0 && (
            <optgroup label="Models">
              {paidModels.map(renderOption)}
            </optgroup>
          )}
          {freeModels.length > 0 && (
            <optgroup label="Free Models">
              {freeModels.map(renderOption)}
            </optgroup>
          )}
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          title="Refresh models"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  )
}
