"use client"

import { useState } from "react"

interface Props {
  text: string
}

export function ReasoningBlock({ text }: Props) {
  const [collapsed, setCollapsed] = useState(true)

  if (!text) return null

  return (
    <div className="mb-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <svg
          className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-90"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Thinking
      </button>
      {!collapsed && (
        <div className="border-t border-zinc-700/50 px-3 py-2">
          <p className="text-xs italic leading-relaxed text-zinc-500 whitespace-pre-wrap">{text}</p>
        </div>
      )}
    </div>
  )
}
