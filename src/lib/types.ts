export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string | ContentPart[]
  reasoning?: string
  timestamp?: number
  tokensPerSecond?: number
  generationTimeMs?: number
}

export interface StreamChunk {
  type: "reasoning" | "content" | "done" | "error"
  text: string
}

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
