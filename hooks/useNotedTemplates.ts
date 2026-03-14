"use client"

import { useState, useCallback } from "react"
import { useCSRF } from "@/hooks/useCSRF"

export interface NotedTemplate {
  id: string
  user_id: string | null
  org_id: string | null
  name: string
  description: string
  category: string
  content: string
  is_system: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export function useNotedTemplates() {
  const [templates, setTemplates] = useState<NotedTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const { csrfToken } = useCSRF()

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (csrfToken) h["x-csrf-token"] = csrfToken
    return h
  }, [csrfToken])

  const fetchTemplates = useCallback(async (category?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (category) params.set("category", category)
      const res = await fetch(`/api/noted/templates?${params.toString()}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch templates")
      const json = await res.json()
      setTemplates(json.data || [])
    } catch (err) {
      console.error("Failed to fetch templates:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const createTemplate = useCallback(async (data: {
    name: string
    description?: string
    category?: string
    content?: string
  }): Promise<NotedTemplate | null> => {
    try {
      const res = await fetch("/api/noted/templates", {
        method: "POST",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create template")
      const json = await res.json()
      await fetchTemplates()
      return json.data
    } catch (err) {
      console.error("Failed to create template:", err)
      return null
    }
  }, [headers, fetchTemplates])

  const updateTemplate = useCallback(async (id: string, data: {
    name?: string
    description?: string
    category?: string
    content?: string
  }): Promise<NotedTemplate | null> => {
    try {
      const res = await fetch(`/api/noted/templates/${id}`, {
        method: "PUT",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update template")
      const json = await res.json()
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...json.data } : t))
      return json.data
    } catch (err) {
      console.error("Failed to update template:", err)
      return null
    }
  }, [headers])

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/noted/templates/${id}`, {
        method: "DELETE",
        headers: headers(),
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete template")
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error("Failed to delete template:", err)
    }
  }, [headers])

  return {
    templates,
    loading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  }
}
