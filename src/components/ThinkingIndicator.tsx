"use client"

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-zinc-400">
      <span className="text-sm">Thinking</span>
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
      </span>
    </div>
  )
}
