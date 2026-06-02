"use client"

import { useState, useEffect, useCallback } from "react"
import type { ModelInfo } from "@/lib/types"

export function useModels() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/models")
      if (!res.ok) throw new Error(`Failed to fetch models (${res.status})`)
      const data: ModelInfo[] = await res.json()
      setModels(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch models")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const freeModels = models.filter((m) => m.id.toLowerCase().includes("free"))
  const paidModels = models.filter((m) => !m.id.toLowerCase().includes("free"))

  return { models, freeModels, paidModels, loading, error, refetch: fetchModels }
}
