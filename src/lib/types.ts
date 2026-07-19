export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: string | ContentPart[]
  reasoning?: string
  timestamp?: number
  tokensPerSecond?: number
  generationTimeMs?: number
  /** Assistant messages: tool calls the model emitted. */
  tool_calls?: ToolCall[]
  /** Tool messages: id of the tool_call this is responding to. */
  tool_call_id?: string
  /** Final assistant message: URLs the AI consulted during a web search turn. */
  sources?: string[]
}

export type StreamChunk =
  | { type: "reasoning" | "content" | "done" | "error"; text: string }
  | { type: "tool_calls_required"; tool_calls: ToolCall[] }

export interface ModelParams {
  temperature: number
  max_tokens: number
  top_p: number
}

export interface ChatRequest {
  model: string
  messages: { role: string; content: string | ContentPart[] }[]
  system_prompt?: string
  reasoning_effort?: string | null
  temperature?: number
  max_tokens?: number
  top_p?: number
}

export interface Conversation {
  model: string
  system_prompt: string
  messages: ChatMessage[]
  reasoning_effort: string | null
  temperature: number
  max_tokens: number
  top_p: number
  input_tokens: number
  output_tokens: number
  saved_at?: string
}

export interface ModelInfo {
  id: string
  object: string
  created: number
  owned_by: string
  supports_vision: boolean
}

export interface SearchResult {
  title: string
  href: string
  body: string
}

export interface SearchResponse {
  results: SearchResult[]
}

export interface ExtractResponse {
  url: string
  content: string
}
