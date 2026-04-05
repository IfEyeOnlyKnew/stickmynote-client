"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  cachePage,
  cachePages,
  getAllCachedPages,
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  getSyncQueueCount,
} from "@/lib/noted/offline-db"
import { useCSRF } from "@/hooks/useCSRF"

export function useNotedOffline() {
  const [isOnline, setIsOnline] = useState(true)
  const [syncPending, setSyncPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const { csrfToken } = useCSRF()
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (csrfToken) h["x-csrf-token"] = csrfToken
    return h
  }, [csrfToken])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    setIsOnline(navigator.onLine)
    globalThis.addEventListener("online", handleOnline)
    globalThis.addEventListener("offline", handleOffline)

    return () => {
      globalThis.removeEventListener("online", handleOnline)
      globalThis.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getSyncQueueCount()
      setSyncPending(count)
    } catch {
      // IndexedDB may not be available
    }
  }, [])

  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount])

  // Cache pages for offline access
  const cachePageForOffline = useCallback(
    async (page: { id: string; title: string; content: string; group_id: string | null; updated_at: string }) => {
      try {
        await cachePage({
          id: page.id,
          title: page.title,
          content: page.content,
          group_id: page.group_id,
          updated_at: page.updated_at,
          cached_at: Date.now(),
        })
      } catch (err) {
        console.error("Failed to cache page:", err)
      }
    },
    []
  )

  const cachePagesForOffline = useCallback(
    async (pages: { id: string; title: string; content: string; group_id: string | null; updated_at: string }[]) => {
      try {
        await cachePages(
          pages.map((p) => ({
            id: p.id,
            title: p.title,
            content: p.content,
            group_id: p.group_id,
            updated_at: p.updated_at,
            cached_at: Date.now(),
          }))
        )
      } catch (err) {
        console.error("Failed to cache pages:", err)
      }
    },
    []
  )

  // Get cached pages when offline
  const getOfflinePages = useCallback(async () => {
    try {
      return await getAllCachedPages()
    } catch {
      return []
    }
  }, [])

  // Queue an offline edit for later sync
  const queueOfflineEdit = useCallback(
    async (pageId: string, data: Record<string, unknown>) => {
      try {
        await addToSyncQueue({ page_id: pageId, action: "update", data })
        // Also update the local cache immediately
        await cachePage({
          id: pageId,
          title: (data.title as string) || "",
          content: (data.content as string) || "",
          group_id: (data.group_id as string | null) || null,
          updated_at: new Date().toISOString(),
          cached_at: Date.now(),
        })
        await refreshPendingCount()
      } catch (err) {
        console.error("Failed to queue offline edit:", err)
      }
    },
    [refreshPendingCount]
  )

  // Sync queued changes to server
  const syncToServer = useCallback(async () => {
    if (!isOnline || syncing) return

    try {
      setSyncing(true)
      const queue = await getSyncQueue()

      for (const item of queue) {
        try {
          if (item.action === "update") {
            const res = await fetch(`/api/noted/pages/${item.page_id}`, {
              method: "PUT",
              headers: headers(),
              credentials: "include",
              body: JSON.stringify(item.data),
            })
            if (res.ok) {
              await removeSyncQueueItem(item.id)
            }
          }
        } catch {
          // Will retry on next sync cycle
          break
        }
      }

      await refreshPendingCount()
    } finally {
      setSyncing(false)
    }
  }, [isOnline, syncing, headers, refreshPendingCount])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && syncPending > 0) {
      syncToServer()
    }
  }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic sync attempt
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      if (isOnline && syncPending > 0) {
        syncToServer()
      }
    }, 30000) // every 30 seconds

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    }
  }, [isOnline, syncPending, syncToServer])

  return {
    isOnline,
    syncPending,
    syncing,
    cachePageForOffline,
    cachePagesForOffline,
    getOfflinePages,
    queueOfflineEdit,
    syncToServer,
  }
}
