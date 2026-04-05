"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "@/hooks/use-toast"
import type { NoteTab } from "@/types/note"
import type { NoteTabsConfig } from "@/types/note-tabs-config"

export function useNoteTabs(noteId: string, resetKey: number | undefined, config: NoteTabsConfig) {
  const [noteTabs, setNoteTabs] = useState<NoteTab[]>([])
  const [loading, setLoading] = useState(true)

  const loadTabs = useCallback(async () => {
    if (!noteId) {
      setNoteTabs([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const tabs = await config.getNoteTabs(noteId)
      setNoteTabs(tabs)
    } catch (error: any) {
      const errorMsg = error?.message || String(error || "")
      const is404 = errorMsg.includes("404") || errorMsg.includes("Not found")
      const isUnauth = errorMsg.includes("401") || errorMsg.includes("Unauthorized")
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("Too Many")

      if (is404 || isUnauth || isRateLimit) {
        setNoteTabs([])
      } else {
        console.error("Error loading tabs:", error)
        toast({
          title: "Error",
          description: `Failed to load media tabs for this ${config.isTeamNote ? "team " : ""}note.`,
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }, [noteId, config])

  const refreshTabs = useCallback(async () => {
    if (!noteId) return

    try {
      const tabs = await config.getNoteTabs(noteId)
      setNoteTabs(tabs)
    } catch (error: any) {
      const errorMsg = error?.message || String(error || "")
      const is404 = errorMsg.includes("404") || errorMsg.includes("Not found")
      const isUnauth = errorMsg.includes("401") || errorMsg.includes("Unauthorized")
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("Too Many")

      if (!is404 && !isUnauth && !isRateLimit) {
        console.error("Error refreshing tabs:", error)
      }
    }
  }, [noteId, config])

  useEffect(() => {
    if (noteId) {
      loadTabs()
    }
  }, [noteId, resetKey, loadTabs])

  useEffect(() => {
    if (typeof globalThis.window !== "undefined" && config.globalRefreshFunctionName) {
      ;(globalThis as any)[config.globalRefreshFunctionName] = refreshTabs

      // Also listen for custom event
      const eventName = config.globalRefreshFunctionName
      if (eventName) {
        const handleRefreshEvent = () => refreshTabs()
        globalThis.addEventListener(eventName, handleRefreshEvent)

        return () => {
          globalThis.removeEventListener(eventName, handleRefreshEvent)
        }
      }
    }
  }, [refreshTabs, config.globalRefreshFunctionName])

  return {
    noteTabs,
    setNoteTabs,
    loading,
    refreshTabs,
  }
}
