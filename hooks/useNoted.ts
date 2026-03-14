"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useCSRF } from "@/hooks/useCSRF"

export interface NotedPage {
  id: string
  stick_id: string | null
  personal_stick_id: string | null
  user_id: string
  org_id: string
  title: string
  content: string
  group_id: string | null
  is_personal: boolean
  source_content: string
  display_title: string
  created_at: string
  updated_at: string
}

export interface NotedGroup {
  id: string
  user_id: string
  org_id: string
  name: string
  color: string
  sort_order: number
  parent_id: string | null
  created_at: string
  updated_at: string
}

export function useNoted() {
  const [pages, setPages] = useState<NotedPage[]>([])
  const [groups, setGroups] = useState<NotedGroup[]>([])
  const [selectedPage, setSelectedPage] = useState<NotedPage | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const { csrfToken } = useCSRF()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PAGE_SIZE = 30

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (csrfToken) h["x-csrf-token"] = csrfToken
    return h
  }, [csrfToken])

  const initialLoadDone = useRef(false)

  // Fetch pages with given filters (resets to first page)
  const fetchPages = useCallback(async (groupId?: string | null, search?: string) => {
    try {
      const params = new URLSearchParams()
      const gid = groupId ?? activeGroupId
      const sq = search ?? searchQuery
      if (gid) params.set("group_id", gid)
      if (sq) params.set("search", sq)
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", "0")

      const res = await fetch(`/api/noted/pages?${params.toString()}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch pages")
      const json = await res.json()
      setPages(json.data || [])
      setHasMore(json.has_more || false)
    } catch (err) {
      console.error("Failed to fetch Noted pages:", err)
    }
  }, [activeGroupId, searchQuery, PAGE_SIZE])

  // Load more pages (append to existing list)
  const loadMorePages = useCallback(async () => {
    if (loadingMore || !hasMore) return
    try {
      setLoadingMore(true)
      const params = new URLSearchParams()
      if (activeGroupId) params.set("group_id", activeGroupId)
      if (searchQuery) params.set("search", searchQuery)
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(pages.length))

      const res = await fetch(`/api/noted/pages?${params.toString()}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch more pages")
      const json = await res.json()
      setPages(prev => [...prev, ...(json.data || [])])
      setHasMore(json.has_more || false)
    } catch (err) {
      console.error("Failed to load more Noted pages:", err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, activeGroupId, searchQuery, pages.length, PAGE_SIZE])

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/noted/groups", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch groups")
      const json = await res.json()
      setGroups(json.data || [])
    } catch (err) {
      console.error("Failed to fetch Noted groups:", err)
    }
  }, [])

  // Initial load (once)
  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchPages(null, ""), fetchGroups()])
      setLoading(false)
      initialLoadDone.current = true
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch pages when group or search changes (after initial load)
  useEffect(() => {
    if (!initialLoadDone.current) return
    fetchPages()
  }, [activeGroupId, searchQuery, fetchPages])

  // Create a Noted page from a Stick
  const createPage = useCallback(async (data: {
    stick_id?: string | null
    personal_stick_id?: string | null
    title?: string
    content?: string
    group_id?: string | null
    is_personal?: boolean
    source_content?: string
  }): Promise<NotedPage | null> => {
    try {
      const res = await fetch("/api/noted/pages", {
        method: "POST",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create page")
      const json = await res.json()

      if (json.existing) {
        // Page already exists, just return it
        return json.data
      }

      await fetchPages()
      return json.data
    } catch (err) {
      console.error("Failed to create Noted page:", err)
      return null
    }
  }, [headers, fetchPages])

  // Update a page (debounced auto-save for content)
  const updatePage = useCallback(async (
    id: string,
    data: { title?: string; content?: string; group_id?: string | null }
  ) => {
    try {
      setSaving(true)
      const res = await fetch(`/api/noted/pages/${id}`, {
        method: "PUT",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update page")
      const json = await res.json()

      // Update local state
      setPages(prev => prev.map(p => p.id === id ? { ...p, ...json.data } : p))
      if (selectedPage?.id === id) {
        setSelectedPage(prev => prev ? { ...prev, ...json.data } : null)
      }

      return json.data
    } catch (err) {
      console.error("Failed to update Noted page:", err)
      return null
    } finally {
      setSaving(false)
    }
  }, [headers, selectedPage?.id])

  // Debounced content save
  const saveContent = useCallback((id: string, content: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      updatePage(id, { content })
    }, 1000)
  }, [updatePage])

  // Delete a page
  const deletePage = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/noted/pages/${id}`, {
        method: "DELETE",
        headers: headers(),
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete page")

      setPages(prev => prev.filter(p => p.id !== id))
      if (selectedPage?.id === id) setSelectedPage(null)
    } catch (err) {
      console.error("Failed to delete Noted page:", err)
    }
  }, [headers, selectedPage?.id])

  // Create a group
  const createGroup = useCallback(async (name: string, color?: string, parentId?: string | null): Promise<NotedGroup | null> => {
    try {
      const res = await fetch("/api/noted/groups", {
        method: "POST",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify({ name, color, parent_id: parentId || null }),
      })
      if (!res.ok) throw new Error("Failed to create group")
      const json = await res.json()
      await fetchGroups()
      return json.data
    } catch (err) {
      console.error("Failed to create Noted group:", err)
      return null
    }
  }, [headers, fetchGroups])

  // Update a group
  const updateGroup = useCallback(async (id: string, data: { name?: string; color?: string; sort_order?: number }) => {
    try {
      const res = await fetch(`/api/noted/groups/${id}`, {
        method: "PUT",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update group")
      const json = await res.json()
      setGroups(prev => prev.map(g => g.id === id ? { ...g, ...json.data } : g))
      return json.data
    } catch (err) {
      console.error("Failed to update Noted group:", err)
      return null
    }
  }, [headers])

  // Delete a group
  const deleteGroup = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/noted/groups/${id}`, {
        method: "DELETE",
        headers: headers(),
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete group")
      setGroups(prev => prev.filter(g => g.id !== id))
      if (activeGroupId === id) setActiveGroupId(null)
      await fetchPages()
    } catch (err) {
      console.error("Failed to delete Noted group:", err)
    }
  }, [headers, activeGroupId, fetchPages])

  // Select a page and fetch full content
  const selectPage = useCallback(async (page: NotedPage) => {
    try {
      const res = await fetch(`/api/noted/pages/${page.id}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch page")
      const json = await res.json()
      setSelectedPage(json.data)
    } catch (err) {
      console.error("Failed to fetch Noted page:", err)
      setSelectedPage(page)
    }
  }, [])

  // Check if a stick has a noted page
  const checkStickNoted = useCallback(async (stickId: string, isPersonal = false): Promise<{ exists: boolean; id?: string }> => {
    try {
      const params = isPersonal ? "?personal=true" : ""
      const res = await fetch(`/api/noted/pages/by-stick/${stickId}${params}`, { credentials: "include" })
      if (!res.ok) return { exists: false }
      const json = await res.json()
      return { exists: json.exists, id: json.data?.id }
    } catch {
      return { exists: false }
    }
  }, [])

  return {
    pages,
    groups,
    selectedPage,
    activeGroupId,
    loading,
    saving,
    searchQuery,
    setSearchQuery,
    setActiveGroupId,
    setSelectedPage,
    selectPage,
    createPage,
    updatePage,
    saveContent,
    deletePage,
    createGroup,
    updateGroup,
    deleteGroup,
    checkStickNoted,
    fetchPages,
    fetchGroups,
    loadMorePages,
    hasMore,
    loadingMore,
  }
}
