"use client"

import { useEffect, useRef } from "react"
import type { ChatMessage as ChatMessageType } from "@/lib/types"
import { countTokens } from "@/lib/tokens"
import { ChatMessage } from "./ChatMessage"
import { ThinkingIndicator } from "./ThinkingIndicator"

interface Props {
  messages: ChatMessageType[]
  isStreaming: boolean
  streamingContent: string
  streamingReasoning: string
  onEditMessage?: (index: number, newContent: string) => void
}

export function ChatMessages({ messages, isStreaming, streamingContent, streamingReasoning, onEditMessage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const streamStartRef = useRef<number>(0)

  // Track streaming start time for live tokens/s calculation
  if (isStreaming && streamStartRef.current === 0) {
    streamStartRef.current = Date.now()
  }
  if (!isStreaming) {
    streamStartRef.current = 0
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent, streamingReasoning])

  // Compute live tokens/s during streaming
  let liveTokensPerSecond: number | undefined
  let liveElapsedMs: number | undefined
  if (isStreaming && streamStartRef.current > 0 && streamingContent) {
    liveElapsedMs = Date.now() - streamStartRef.current
    const elapsed = liveElapsedMs / 1000
    const tokens = countTokens(streamingContent) + 4
    if (elapsed > 0.5 && tokens > 0) {
      liveTokensPerSecond = Math.round((tokens / elapsed) * 10) / 10
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.length === 0 && !isStreaming && (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <h2 className="mt-4 text-lg font-medium text-zinc-400">Nvidia NIM Chat</h2>
            <p className="mt-1 text-sm text-zinc-600">Send a message to start chatting</p>
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <ChatMessage
          key={i}
          role={msg.role}
          content={msg.content}
          reasoning={msg.reasoning}
          tokensPerSecond={msg.tokensPerSecond}
          generationTimeMs={msg.generationTimeMs}
          isStreaming={false}
          isLatest={false}
          onEdit={onEditMessage ? (newContent) => onEditMessage(i, newContent) : undefined}
        />
      ))}

      {isStreaming && (
        <ChatMessage
          role="assistant"
          content={streamingContent}
          reasoning={streamingReasoning}
          tokensPerSecond={liveTokensPerSecond}
          liveElapsedMs={liveElapsedMs}
          isStreaming={true}
          isLatest={true}
        />
      )}

      {isStreaming && !streamingContent && !streamingReasoning && <ThinkingIndicator />}

      <div ref={bottomRef} />
    </div>
  )
}
