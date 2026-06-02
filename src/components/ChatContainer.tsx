"use client"

import { useState } from "react"
import { useChat } from "@/hooks/useChat"
import { useModels } from "@/hooks/useModels"
import { ChatMessages } from "./ChatMessages"
import { ChatInput } from "./ChatInput"
import { ModelSelector } from "./ModelSelector"
import { EffortSelector } from "./EffortSelector"
import { SystemPromptModal } from "./SystemPromptModal"
import { ConversationInfo } from "./ConversationInfo"
import { TokenBar } from "./TokenBar"
import { ModelParamsModal } from "./ModelParamsModal"

export function ChatContainer() {
  const {
    messages,
    inputTokens,
    outputTokens,
    isStreaming,
    streamingContent,
    streamingReasoning,
    error,
    settings,
    sendMessage,
    editAndResend,
    cancelStream,
    clearConversation,
    exportConversation,
    setModel,
    setSystemPrompt,
    setReasoningEffort,
    setTemperature,
    setMaxTokens,
    setTopP,
  } = useChat()

  const { models, paidModels, freeModels, loading: modelsLoading, refetch: refetchModels } = useModels()

  const [showSystemModal, setShowSystemModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showParamsModal, setShowParamsModal] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  return (
    <div className="flex h-dvh flex-col bg-zinc-900 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 md:px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-emerald-400">NIM Chat</h1>
          <div className="hidden md:block">
            <ModelSelector
              currentModel={settings.model}
              models={models}
              paidModels={paidModels}
              freeModels={freeModels}
              loading={modelsLoading}
              onSelect={setModel}
              onRefresh={refetchModels}
            />
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <EffortSelector value={settings.reasoningEffort} onChange={setReasoningEffort} />

          <button
            onClick={() => setShowParamsModal(true)}
            className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Model parameters"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

          <button
            onClick={() => setShowSystemModal(true)}
            className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="System prompt"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <button
            onClick={() => setShowInfo(true)}
            className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Conversation info"
            disabled={messages.length === 0}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <button
            onClick={exportConversation}
            className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Export conversation"
            disabled={messages.length === 0}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            onClick={clearConversation}
            className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Clear conversation"
            disabled={messages.length === 0 && !isStreaming}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setShowMobileMenu(true)}
          className="md:hidden rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="Open menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Error bar */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/40 px-4 py-2 border-b border-red-800/40">
          <svg className="h-4 w-4 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-300">{error}</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-auto text-xs text-red-400 underline hover:text-red-300"
          >
            Reload
          </button>
        </div>
      )}

      {/* Messages */}
      <ChatMessages
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        streamingReasoning={streamingReasoning}
        onEditMessage={editAndResend}
      />

      {/* Token bar */}
      <TokenBar inputTokens={inputTokens} outputTokens={outputTokens} />

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onCancel={cancelStream}
        isStreaming={isStreaming}
        supportsVision={models.find((m) => m.id === settings.model)?.supports_vision ?? false}
      />

      {/* Mobile drawer */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* Drawer panel */}
          <div className="absolute right-0 top-0 h-full w-72 border-l border-zinc-800 bg-zinc-900 shadow-2xl translate-x-0 transition-transform">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <span className="text-sm font-medium text-zinc-300">Menu</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6">
              {/* Model selector section */}
              <div>
                <span className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wider">Model</span>
                <div className="w-full">
                  <ModelSelector
                    currentModel={settings.model}
                    models={models}
                    paidModels={paidModels}
                    freeModels={freeModels}
                    loading={modelsLoading}
                    onSelect={setModel}
                    onRefresh={refetchModels}
                  />
                </div>
              </div>

              {/* Effort selector section */}
              <div>
                <span className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wider">Reasoning Effort</span>
                <EffortSelector value={settings.reasoningEffort} onChange={setReasoningEffort} />
              </div>

              {/* Model parameters section */}
              <div>
                <span className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wider">Parameters</span>
                <button
                  onClick={() => { setShowParamsModal(true); setShowMobileMenu(false) }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                >
                  <svg className="h-4 w-4 flex-shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span className="flex items-center justify-between flex-1">
                    <span>Model Parameters</span>
                    <span className="text-xs text-zinc-500">
                      T:{(settings.temperature ?? 0.7).toFixed(1)} M:{Math.round((settings.maxTokens ?? 4096) / 1000)}k P:{(settings.topP ?? 1).toFixed(2)}
                    </span>
                  </span>
                </button>
              </div>

              {/* Actions */}
              <div>
                <span className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</span>
                <div className="space-y-1">
                          <button
                    onClick={() => { setShowSystemModal(true); setShowMobileMenu(false) }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                  >
                    <svg className="h-4 w-4 flex-shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    System Prompt
                  </button>
                  <button
                    onClick={() => { setShowInfo(true); setShowMobileMenu(false) }}
                    disabled={messages.length === 0}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="h-4 w-4 flex-shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Conversation Info
                  </button>
                  <button
                    onClick={() => { exportConversation(); setShowMobileMenu(false) }}
                    disabled={messages.length === 0}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="h-4 w-4 flex-shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Conversation
                  </button>
                  <button
                    onClick={() => { clearConversation(); setShowMobileMenu(false) }}
                    disabled={messages.length === 0 && !isStreaming}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="h-4 w-4 flex-shrink-0 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear Conversation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SystemPromptModal
        current={settings.systemPrompt}
        onSave={setSystemPrompt}
        open={showSystemModal}
        onOpenChange={setShowSystemModal}
      />
      <ConversationInfo
        messages={messages.length}
        inputTokens={inputTokens}
        outputTokens={outputTokens}
        model={settings.model}
        systemPrompt={settings.systemPrompt}
        reasoningEffort={settings.reasoningEffort}
        open={showInfo}
        onOpenChange={setShowInfo}
      />
      <ModelParamsModal
        temperature={settings.temperature}
        maxTokens={settings.maxTokens}
        topP={settings.topP}
        onSave={({ temperature, maxTokens, topP }) => {
          setTemperature(temperature)
          setMaxTokens(maxTokens)
          setTopP(topP)
        }}
        open={showParamsModal}
        onOpenChange={setShowParamsModal}
      />
    </div>
  )
}
