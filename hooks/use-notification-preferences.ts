"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { NotificationPreferences, PadNotificationSettings } from "@/types/notification-preferences"

const DEFAULT_PREFERENCES: NotificationPreferences = {
  id: "",
  user_id: "",
  email_enabled: true,
  push_enabled: false,
  in_app_enabled: true,
  digest_frequency: "instant",
  digest_time: "09:00:00",
  digest_day_of_week: 1,
  stick_created_enabled: true,
  stick_updated_enabled: true,
  stick_replied_enabled: true,
  reaction_enabled: true,
  member_added_enabled: true,
  pad_invite_enabled: true,
  pad_preferences: {},
  muted_users: [],
  created_at: "",
  updated_at: "",
}

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/notification-preferences")

      if (response.status === 429) {
        // Rate limited - use defaults silently
        setPreferences(DEFAULT_PREFERENCES)
        setError(null)
        return
      }

      if (!response.ok) {
        // For other errors, use defaults
        setPreferences(DEFAULT_PREFERENCES)
        setError(null)
        return
      }

      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        // Non-JSON response - use defaults
        setPreferences(DEFAULT_PREFERENCES)
        setError(null)
        return
      }

      const data = await response.json()
      setPreferences(data.preferences || DEFAULT_PREFERENCES)
      setError(null)
    } catch (err) {
      setError(null)
      setPreferences(DEFAULT_PREFERENCES)
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    try {
      const response = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error("Failed to update preferences")
      }

      const data = await response.json()
      setPreferences(data.preferences)
      return data.preferences
    } catch (err) {
      console.error("Error updating notification preferences:", err)
      throw err
    }
  }, [])

  const updatePadSettings = useCallback(async (padId: string, settings: Partial<PadNotificationSettings>) => {
    try {
      const response = await fetch(`/api/notification-preferences/pads/${padId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error("Failed to update pad settings")
      }

      const data = await response.json()
      setPreferences(data.preferences)
      return data.preferences
    } catch (err) {
      console.error("Error updating pad notification settings:", err)
      throw err
    }
  }, [])

  const muteUser = useCallback(
    async (userId: string) => {
      if (!preferences) return

      const mutedUsers = [...(preferences.muted_users || []), userId]
      await updatePreferences({ muted_users: mutedUsers })
    },
    [preferences, updatePreferences],
  )

  const unmuteUser = useCallback(
    async (userId: string) => {
      if (!preferences) return

      const mutedUsers = (preferences.muted_users || []).filter((id) => id !== userId)
      await updatePreferences({ muted_users: mutedUsers })
    },
    [preferences, updatePreferences],
  )

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchPreferences()
    }
  }, [fetchPreferences])

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    updatePadSettings,
    muteUser,
    unmuteUser,
    refresh: fetchPreferences,
  }
}
