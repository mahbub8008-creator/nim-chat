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
    // Mistral family: Mistral Large 3/3.x is multimodal; Pixtral is Mistral's
    // vision line. Recognize both so the 📷 icon shows up next to these
    // models in the dropdown.
    "pixtral",
    "mistral-large-3",
    "mistral-3",
    "magistral",
    // Qwen family: only the VL (Vision-Language) variants are multimodal.
    // Generic "qwen" models are text-only, so we match the explicit VL lines.
    "qwen-vl",
    "qwen2-vl",
    "qwen2.5-vl",
    "qwen3-vl",
    // Thinking Machines: Inkling is a multimodal MoE (text + image + audio).
    // The name doesn't contain any vision keyword, so it must be listed explicitly.
    "inkling",
    // NVIDIA Cosmos: Cosmos-Reason and Cosmos-3 models are vision-capable.
    "cosmos",
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
