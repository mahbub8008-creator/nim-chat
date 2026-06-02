export const API_BASE = "https://integrate.api.nvidia.com/v1"
export const DEFAULT_MODEL = "mistralai/mistral-large-3-675b-instruct-2512"
export const API_TIMEOUT = 60_000
export const MAX_RETRIES = 3
export const MAX_INPUT_CHARS = 10_000
export const HISTORY_KEY = "nim-chat-history"
export const CONVERSATION_KEY = "nim-chat-current"
export const SETTINGS_KEY = "nim-chat-settings"

export const DEFAULT_TEMPERATURE = 0.7
export const DEFAULT_MAX_TOKENS = 4096
export const DEFAULT_TOP_P = 1

export const COST_RATES = {
  input: 3.50,
  output: 12.00,
  label: "NIM llama-3.1-405b (est.)",
} as const

/**
 * Check if a model ID supports vision/image inputs.
 * Uses a comprehensive set of keywords and model family patterns
 * found in the NVIDIA NIM vision model catalog.
 */
export function isVisionModel(modelId: string): boolean {
  const id = modelId.toLowerCase()

  // Direct keywords that indicate vision capability
  const visionKeywords = [
    "vision",
    "vlm",
    "multimodal",
    "omni",
  ]

  // Model family patterns (specific model IDs that support vision)
  const visionFamilies = [
    "llava",
    "neva",
    "paligemma",
    "cambrian",
    "vila",
    "internvl",
    "internlm-xcomposer",
    "deepseek-vl",
    "yi-vision",
    "cogvlm",
    "florence",
    "kosmos",
    "fuyu",
    "nvclip",
    "nemoretriever",
    "gemma-3",
  ]

  // Check keywords first
  for (const kw of visionKeywords) {
    if (id.includes(kw)) return true
  }

  // Check family patterns
  for (const family of visionFamilies) {
    if (id.includes(family)) return true
  }

  return false
}
