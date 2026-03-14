"use client"

import { useState, useCallback } from "react"
import { useCSRF } from "@/hooks/useCSRF"

export interface NotedTag {
  id: string
  org_id: string
  name: string
  color: string
  parent_id: string | null
  created_by: string
  created_at: string
  page_count?: number
}

export function useNotedTags() {
  const [allTags, setAllTags] = useState<NotedTag[]>([])
  const [pageTags, setPageTags] = useState<NotedTag[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const { csrfToken } = useCSRF()

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (csrfToken) h["x-csrf-token"] = csrfToken
    return h
  }, [csrfToken])

  const fetchAllTags = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/noted/tags", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch tags")
      const json = await res.json()
      setAllTags(json.data || [])
    } catch (err) {
      console.error("Failed to fetch tags:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPageTags = useCallback(async (pageId: string) => {
    try {
      const res = await fetch(`/api/noted/pages/${pageId}/tags`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch page tags")
      const json = await res.json()
      setPageTags(json.data || [])
    } catch (err) {
      console.error("Failed to fetch page tags:", err)
    }
  }, [])

  const addTagToPage = useCallback(async (pageId: string, tagIdOrName: string, color?: string) => {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tagIdOrName)
      const body = isUuid
        ? { tag_id: tagIdOrName }
        : { tag_name: tagIdOrName, color }

      const res = await fetch(`/api/noted/pages/${pageId}/tags`, {
        method: "POST",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to add tag")
      const json = await res.json()
      setPageTags(json.data || [])
      await fetchAllTags()
    } catch (err) {
      console.error("Failed to add tag:", err)
    }
  }, [headers, fetchAllTags])

  const removeTagFromPage = useCallback(async (pageId: string, tagId: string) => {
    try {
      const res = await fetch(`/api/noted/pages/${pageId}/tags?tag_id=${tagId}`, {
        method: "DELETE",
        headers: headers(),
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to remove tag")
      setPageTags((prev) => prev.filter((t) => t.id !== tagId))
    } catch (err) {
      console.error("Failed to remove tag:", err)
    }
  }, [headers])

  const suggestTags = useCallback(async (title: string, content: string) => {
    try {
      setSuggesting(true)
      const res = await fetch("/api/noted/tags/suggest", {
        method: "POST",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify({ title, content }),
      })
      if (!res.ok) throw new Error("Failed to suggest tags")
      const json = await res.json()
      setSuggestions(json.data?.suggestions || [])
    } catch (err) {
      console.error("Failed to suggest tags:", err)
      setSuggestions([])
    } finally {
      setSuggesting(false)
    }
  }, [headers])

  const deleteTag = useCallback(async (tagId: string) => {
    try {
      const res = await fetch(`/api/noted/tags/${tagId}`, {
        method: "DELETE",
        headers: headers(),
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete tag")
      setAllTags((prev) => prev.filter((t) => t.id !== tagId))
      setPageTags((prev) => prev.filter((t) => t.id !== tagId))
    } catch (err) {
      console.error("Failed to delete tag:", err)
    }
  }, [headers])

  return {
    allTags,
    pageTags,
    suggestions,
    loading,
    suggesting,
    fetchAllTags,
    fetchPageTags,
    addTagToPage,
    removeTagFromPage,
    suggestTags,
    deleteTag,
  }
}
