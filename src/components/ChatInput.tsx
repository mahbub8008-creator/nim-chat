"use client"

import { useState, useRef, type KeyboardEvent } from "react"

interface Props {
  onSend: (message: string, images?: string[]) => void
  onCancel: () => void
  isStreaming: boolean
  disabled?: boolean
  supportsVision?: boolean
}

const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_IMAGES = 10

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ChatInput({ onSend, onCancel, isStreaming, disabled, supportsVision = true }: Props) {
  const [input, setInput] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)

  const handleSubmit = () => {
    const trimmed = input.trim()
    if ((!trimmed && images.length === 0) || isStreaming) return
    // Don't send images if model doesn't support vision
    if (images.length > 0 && !supportsVision) {
      setImageError("Current model does not support image input")
      return
    }
    onSend(trimmed, images.length > 0 ? images : undefined)
    setInput("")
    setImages([])
    setImageError(null)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isStreaming || disabled || !supportsVision) return

    const items = Array.from(e.clipboardData.items)
    const imageFiles = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)

    if (imageFiles.length === 0) return

    e.preventDefault()

    // Filter to accepted types
    const validFiles = imageFiles.filter((f) =>
      ACCEPTED_TYPES.includes(f.type)
    )

    if (validFiles.length === 0) {
      setImageError(`Unsupported image format. Accepted: JPEG, PNG, GIF, WebP`)
      return
    }

    await processFiles(validFiles)
  }

  const processFiles = async (files: File[]) => {
    setImageError(null)

    if (files.length === 0) return

    // Validate count
    if (images.length + files.length > MAX_IMAGES) {
      setImageError(`Maximum ${MAX_IMAGES} images allowed`)
      return
    }

    // Validate types and sizes
    const invalidTypes = files.filter((f) => !ACCEPTED_TYPES.includes(f.type))
    const oversized = files.filter((f) => f.size > MAX_IMAGE_SIZE)
    const validFiles = files.filter((f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_IMAGE_SIZE)

    if (invalidTypes.length > 0) {
      setImageError(`Unsupported file type. Accepted: JPEG, PNG, GIF, WebP`)
    }
    if (oversized.length > 0) {
      setImageError(`Image too large. Maximum size: 20MB`)
    }

    if (validFiles.length === 0) return

    try {
      const dataUrls = await Promise.all(validFiles.map(readFileAsDataURL))
      setImages((prev) => [...prev, ...dataUrls].slice(0, MAX_IMAGES))
    } catch {
      setImageError("Failed to read image file")
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    await processFiles(files)
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    dragCounterRef.current = 0

    if (!supportsVision) {
      setImageError("Current model does not support image input")
      return
    }

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ACCEPTED_TYPES.includes(f.type)
    )

    if (files.length === 0) {
      // Check if any files were dropped at all
      if (e.dataTransfer.files.length > 0) {
        setImageError(`Unsupported file type. Accepted: JPEG, PNG, GIF, WebP`)
      }
      return
    }

    await processFiles(files)
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length === 0) setImageError(null)
      return next
    })
  }

  return (
    <div
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex flex-col border-t border-zinc-800 transition-colors ${isDragOver ? "bg-emerald-950/30" : ""}`}
    >
      {/* Drag-over overlay */}
      {isDragOver && supportsVision && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-emerald-500 bg-zinc-950/80">
          <div className="flex flex-col items-center gap-2 text-emerald-400">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm font-medium">Drop images here</span>
            <span className="text-xs text-emerald-500/60">JPEG, PNG, GIF, WebP &middot; Max 20MB each</span>
          </div>
        </div>
      )}
      {/* Image preview strip */}
      {images.length > 0 && (
        <div className="flex gap-2 px-3 pt-3 pb-1 overflow-x-auto">
          {images.map((dataUrl, i) => (
            <div key={i} className="relative flex-shrink-0 group">
              <img
                src={dataUrl}
                alt={`Upload ${i + 1}`}
                className="h-16 w-16 rounded-lg object-cover border border-zinc-700"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                title="Remove image"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {imageError && (
        <div className="px-3 pt-2">
          <p className="text-xs text-red-400">{imageError}</p>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 p-3 md:p-4">
        {/* Image upload button - always visible; submit-time validation handles non-vision models */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || disabled || images.length >= MAX_IMAGES || !supportsVision}
          className="flex-shrink-0 rounded-lg p-2.5 text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={supportsVision ? "Upload image" : "Upload image — current model does not accept images"}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />
        </button>

        {/* Text area */}
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={images.length > 0 ? "Add a message or send with just images..." : "Type a message... (Shift+Enter for newline)"}
            rows={1}
            disabled={disabled}
            className="w-full resize-none rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-zinc-700 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = "auto"
              el.style.height = Math.min(el.scrollHeight, 200) + "px"
            }}
          />
        </div>

        {isStreaming ? (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-500 transition-colors"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={(!input.trim() && images.length === 0) || disabled || isStreaming}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Send
          </button>
        )}
      </div>
    </div>
  )
}
