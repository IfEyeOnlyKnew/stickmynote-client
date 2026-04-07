"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "@/hooks/use-toast"
import type { StickTab } from "@/types/pad"
import type { StickTabsConfig } from "@/types/stick-tabs-config"

export function useStickTabs(stickId: string, resetKey: number | undefined, config: StickTabsConfig) {
  const [stickTabs, setStickTabs] = useState<StickTab[]>([])
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  const loadTabs = useCallback(async () => {
    try {
      setLoading(true)
      const tabs = await config.getStickTabs(stickId)
      setStickTabs(tabs)
    } catch (error) {
      console.error("Error loading stick tabs:", error)
      toast({
        title: "Error",
        description: "Failed to load media tabs for this stick.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [stickId, config.getStickTabs])
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  const refreshTabs = useCallback(async () => {
    try {
      const tabs = await config.getStickTabs(stickId)
      setStickTabs(tabs)
    } catch (error) {
      console.error("Error refreshing stick tabs:", error)
    }
  }, [stickId, config.getStickTabs])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (stickId) {
      loadTabs()
    }
  }, [stickId, resetKey, loadTabs])

  useEffect(() => {
    if (globalThis.window !== undefined && config.globalRefreshFunctionName) {
      ;(globalThis as any)[config.globalRefreshFunctionName] = refreshTabs
    }
  }, [refreshTabs, config.globalRefreshFunctionName])

  return {
    stickTabs,
    setStickTabs,
    loading,
    refreshTabs,
  }
}
