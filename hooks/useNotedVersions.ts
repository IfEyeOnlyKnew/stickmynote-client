"use client"

import { useState, useCallback } from "react"
import { useCSRF } from "@/hooks/useCSRF"

export interface NotedPageVersion {
  id: string
  page_id: string
  user_id: string
  title: string
  content?: string
  content_length?: number
  version_number: number
  created_at: string
}

export function useNotedVersions(pageId: string | null) {
  const [versions, setVersions] = useState<NotedPageVersion[]>([])
  const [loading, setLoading] = useState(false)
  const { csrfToken } = useCSRF()

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (csrfToken) h["x-csrf-token"] = csrfToken
    return h
  }, [csrfToken])

  const fetchVersions = useCallback(async () => {
    if (!pageId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/noted/pages/${pageId}/versions`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch versions")
      const json = await res.json()
      setVersions(json.data || [])
    } catch (err) {
      console.error("Failed to fetch versions:", err)
    } finally {
      setLoading(false)
    }
  }, [pageId])

  const createVersion = useCallback(async () => {
    if (!pageId) return null
    try {
      const res = await fetch(`/api/noted/pages/${pageId}/versions`, {
        method: "POST",
        headers: headers(),
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to create version")
      const json = await res.json()
      await fetchVersions()
      return json.data
    } catch (err) {
      console.error("Failed to create version:", err)
      return null
    }
  }, [pageId, headers, fetchVersions])

  const fetchVersion = useCallback(async (versionId: string): Promise<NotedPageVersion | null> => {
    if (!pageId) return null
    try {
      const res = await fetch(`/api/noted/pages/${pageId}/versions/${versionId}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch version")
      const json = await res.json()
      return json.data
    } catch (err) {
      console.error("Failed to fetch version:", err)
      return null
    }
  }, [pageId])

  const restoreVersion = useCallback(async (versionId: string) => {
    if (!pageId) return null
    try {
      const res = await fetch(`/api/noted/pages/${pageId}/versions/${versionId}`, {
        method: "POST",
        headers: headers(),
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to restore version")
      const json = await res.json()
      await fetchVersions()
      return json.data
    } catch (err) {
      console.error("Failed to restore version:", err)
      return null
    }
  }, [pageId, headers, fetchVersions])

  return {
    versions,
    loading,
    fetchVersions,
    createVersion,
    fetchVersion,
    restoreVersion,
  }
}
