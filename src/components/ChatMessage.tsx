/* eslint-disable @next/next/no-img-element */
"use client"

import { useState, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import type { Components } from "react-markdown"
import type { ContentPart } from "@/lib/types"
import { getContentText, imageCount } from "@/lib/tokens"
import { ReasoningBlock } from "./ReasoningBlock"

interface Props {
  role: "user" | "assistant" | "system"
  content: string | ContentPart[]
  reasoning?: string
  isStreaming?: boolean
  isLatest?: boolean
  tokensPerSecond?: number
  generationTimeMs?: number
  liveElapsedMs?: number
  onEdit?: (newContent: string) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded-md bg-zinc-700/60 px-2 py-1 text-xs text-zinc-400 opacity-0 transition-opacity group-hover/code:opacity-100 hover:bg-zinc-600 hover:text-zinc-200"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}

function formatTokensPerSecond(tps: number): string {
  if (tps >= 100) return `${Math.round(tps)} t/s`
  return `${tps.toFixed(1)} t/s`
}

export function ChatMessage({ role, content, reasoning, isStreaming, isLatest, tokensPerSecond, generationTimeMs, liveElapsedMs, onEdit }: Props) {
  const [editing, setEditing] = useState(false)
  const hasContentImages = imageCount(content) > 0
  const displayText = getContentText(content)
  const [editText, setEditText] = useState(displayText)
  const isUser = role === "user"
  const isSystem = role === "system"

  const handleSave = useCallback(() => {
    const trimmed = editText.trim()
    if (trimmed && onEdit) {
      onEdit(trimmed)
    }
    setEditing(false)
  }, [editText, onEdit])

  const handleCancel = useCallback(() => {
    setEditText(displayText)
    setEditing(false)
  }, [displayText])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === "Escape") {
      handleCancel()
    }
  }, [handleSave, handleCancel])

  const components: Partial<Components> = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "")
      const code = String(children).replace(/\n$/, "")
      if (match) {
        return (
          <div className="group/code relative">
            <div className="flex items-center justify-between rounded-t-lg bg-zinc-800 px-4 py-1.5">
              <span className="text-xs text-zinc-500">{match[1]}</span>
            </div>
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderBottomLeftRadius: "0.5rem",
                borderBottomRightRadius: "0.5rem",
                fontSize: "0.8125rem",
              }}
            >
              {code}
            </SyntaxHighlighter>
            <CopyButton text={code} />
          </div>
        )
      }
      return (
        <code className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-sm text-emerald-300" {...props}>
          {children}
        </code>
      )
    },
    pre({ children }) {
      return <div className="my-3 overflow-hidden rounded-lg">{children}</div>
    },
    p({ children }) {
      return <p className="my-2 leading-7">{children}</p>
    },
    ul({ children, ...props }) {
      return <ul className="my-2 list-disc pl-6 space-y-1" {...props}>{children}</ul>
    },
    ol({ children, ...props }) {
      return <ol className="my-2 list-decimal pl-6 space-y-1" {...props}>{children}</ol>
    },
    li({ children, ...props }) {
      return <li className="my-0.5" {...props}>{children}</li>
    },
    a({ href, children }) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">
          {children}
        </a>
      )
    },
    blockquote({ children }) {
      return (
        <blockquote className="my-3 border-l-4 border-emerald-700 bg-zinc-800/30 pl-4 py-2 pr-2 rounded-r-lg text-zinc-400">
          {children}
        </blockquote>
      )
    },
    h1({ children }) { return <h1 className="my-4 text-xl font-bold text-zinc-100">{children}</h1> },
    h2({ children }) { return <h2 className="my-3 text-lg font-bold text-zinc-100">{children}</h2> },
    h3({ children }) { return <h3 className="my-3 text-base font-bold text-zinc-100">{children}</h3> },
    h4({ children }) { return <h4 className="my-2 text-sm font-semibold text-zinc-200">{children}</h4> },
    table({ children }) {
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-700 text-sm">
            {children}
          </table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-zinc-800/60">{children}</thead>
    },
    tbody({ children }) {
      return <tbody className="divide-y divide-zinc-800">{children}</tbody>
    },
    tr({ children }) {
      return <tr className="even:bg-zinc-800/30">{children}</tr>
    },
    th({ children }) {
      return <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-300">{children}</th>
    },
    td({ children }) {
      return <td className="px-4 py-2.5 text-zinc-300">{children}</td>
    },
    img({ src, alt }) {
      return (
        <img
          src={src}
          alt={alt || ""}
          className="my-4 max-w-full rounded-lg border border-zinc-700"
          loading="lazy"
        />
      )
    },
    hr() {
      return <hr className="my-6 border-zinc-700" />
    },
    kbd({ children }) {
      return (
        <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-zinc-300 shadow-sm">
          {children}
        </kbd>
      )
    },
  }

  return (
    <div className={`flex gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 ${isUser ? "" : "bg-zinc-850/50"}`}>
      <div className="flex-shrink-0 mt-1">
        {isUser ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-xs font-medium text-white">
            You
          </div>
        ) : isSystem ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 text-xs font-medium text-white">
            Sys
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-xs font-medium text-white">
            AI
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {!isUser && reasoning && !isLatest && <ReasoningBlock text={reasoning} />}
        {!isUser && isLatest && isStreaming && reasoning && <ReasoningBlock text={reasoning} />}

        {isUser ? (
          editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full resize-none rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-600 focus:ring-emerald-500 transition-colors"
                rows={Math.max(2, editText.split("\n").length)}
                autoFocus
                onInput={(e) => {
                  const el = e.currentTarget
                  el.style.height = "auto"
                  el.style.height = Math.min(el.scrollHeight, 300) + "px"
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!editText.trim()}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              {/* Image previews */}
              {hasContentImages && Array.isArray(content) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {content
                    .filter((p): p is { type: "image_url"; image_url: { url: string } } => p.type === "image_url")
                    .map((part, i) => (
                      <a
                        key={i}
                        href={part.image_url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={part.image_url.url}
                          alt={`Image ${i + 1}`}
                          className="max-h-48 max-w-64 rounded-lg border border-zinc-700 object-cover hover:opacity-90 transition-opacity"
                          loading="lazy"
                        />
                      </a>
                    ))}
                </div>
              )}
              {displayText && (
                <p className="text-sm leading-7 text-zinc-100 whitespace-pre-wrap">{displayText}</p>
              )}
              {onEdit && !hasContentImages && (
                <button
                  onClick={() => { setEditText(displayText); setEditing(true) }}
                  className="absolute -right-1 -top-1 rounded-md p-1.5 text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
                  title="Edit message"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          )
        ) : (
          <div className="prose prose-invert prose-sm max-w-none text-zinc-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {typeof content === "string" ? content : getContentText(content)}
            </ReactMarkdown>
            {!isUser && isStreaming && !displayText && reasoning && (
              <span className="text-xs italic text-zinc-500">Thinking...</span>
            )}
          {!isUser && isStreaming && !displayText && !reasoning && (
            <span className="text-xs italic text-zinc-500">Thinking...</span>
          )}
          </div>
        )}

        {/* Stats badge */}
        {!isUser && (tokensPerSecond !== undefined || generationTimeMs !== undefined || liveElapsedMs !== undefined) && (
          <div className="mt-2 flex items-center gap-3">
            {(generationTimeMs !== undefined || liveElapsedMs !== undefined) && (
              <div className="flex items-center gap-1.5">
                <svg className={`h-3 w-3 ${isStreaming ? "text-emerald-500" : "text-zinc-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`text-xs ${isStreaming ? "text-emerald-500" : "text-zinc-600"}`}>
                  {(liveElapsedMs !== undefined ? liveElapsedMs : generationTimeMs!) < 1000
                    ? `${liveElapsedMs !== undefined ? liveElapsedMs : generationTimeMs!}ms`
                    : `${((liveElapsedMs !== undefined ? liveElapsedMs : generationTimeMs!) / 1000).toFixed(1)}s`}
                  {isStreaming && " elapsed"}
                </span>
              </div>
            )}
            {tokensPerSecond !== undefined && tokensPerSecond > 0 && (
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${isStreaming ? "text-emerald-500" : "text-zinc-600"}`}>
                  {formatTokensPerSecond(tokensPerSecond)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
