import { encode } from "gpt-tokenizer"
import type { ContentPart } from "./types"

export function countTokens(text: string): number {
  try {
    return encode(text).length
  } catch {
    return Math.max(1, Math.floor(text.length / 4))
  }
}

/** Extract text from a content value that may be string or ContentPart[] */
export function getContentText(content: string | ContentPart[]): string {
  if (typeof content === "string") return content
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
}

/** Check if content contains any image parts */
export function hasImages(content: string | ContentPart[]): boolean {
  if (typeof content === "string") return false
  return content.some((part) => part.type === "image_url")
}

/** Get image count from content */
export function imageCount(content: string | ContentPart[]): number {
  if (typeof content === "string") return 0
  return content.filter((part) => part.type === "image_url").length
}
