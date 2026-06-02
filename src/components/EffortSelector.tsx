"use client"

interface Props {
  value: string | null
  onChange: (value: string | null) => void
}

const EFFORTS = [
  { value: null, label: "off", color: "bg-zinc-700" },
  { value: "low", label: "low", color: "bg-yellow-700" },
  { value: "medium", label: "med", color: "bg-orange-700" },
  { value: "high", label: "high", color: "bg-red-700" },
] as const

export function EffortSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-zinc-500 mr-1">effort</span>
      {EFFORTS.map((effort) => (
        <button
          key={effort.label}
          onClick={() => onChange(effort.value)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            value === effort.value
              ? `${effort.color} text-white`
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {effort.label}
        </button>
      ))}
    </div>
  )
}
