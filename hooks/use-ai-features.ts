"use client"

import { useState } from "react"

export function useAIFeatures() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateTags = async (content: string, topic?: string) => {
    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch("/api/ai/generate-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, topic }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate tags")
      }

      const data = await response.json()
      return data.tags as string[]
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to generate tags"
      setError(errorMsg)
      return []
    } finally {
      setIsGenerating(false)
    }
  }

  const summarizeContent = async (content: string, maxLength?: number) => {
    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, maxLength }),
      })

      if (!response.ok) {
        throw new Error("Failed to summarize content")
      }

      const data = await response.json()
      return data.summary as string
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to summarize content"
      setError(errorMsg)
      return ""
    } finally {
      setIsGenerating(false)
    }
  }

  const checkDuplicate = async (content: string, padId: string) => {
    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch("/api/ai/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, padId }),
      })

      if (!response.ok) {
        throw new Error("Failed to check duplicate")
      }

      const data = await response.json()
      return data as { isDuplicate: boolean; similarTo?: string; similarity?: number }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to check duplicate"
      setError(errorMsg)
      return { isDuplicate: false }
    } finally {
      setIsGenerating(false)
    }
  }

  const suggestReplies = async (content: string, topic?: string) => {
    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch("/api/ai/suggest-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, topic }),
      })

      if (!response.ok) {
        throw new Error("Failed to suggest replies")
      }

      const data = await response.json()
      return data.suggestions as string[]
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to suggest replies"
      setError(errorMsg)
      return []
    } finally {
      setIsGenerating(false)
    }
  }

  return {
    generateTags,
    summarizeContent,
    checkDuplicate,
    suggestReplies,
    isGenerating,
    error,
  }
}
