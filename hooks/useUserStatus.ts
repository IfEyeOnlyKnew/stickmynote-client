"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useUser } from "@/contexts/user-context"
import type {
  UserStatus,
  EffectiveUserStatus,
  UpdateStatusRequest,
  UserStatusType,
} from "@/types/user-status"
import { calculateExpiration } from "@/types/user-status"

// Polling interval in milliseconds (30 seconds - matches presence)
const STATUS_POLL_INTERVAL = 30000

// ----------------------------------------------------------------------------
// useUserStatus - Manage current user's status
// ----------------------------------------------------------------------------

export function useUserStatus() {
  const { user } = useUser()
  const [status, setStatusState] = useState<UserStatus | null>(null)
  const [effective, setEffective] = useState<EffectiveUserStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    if (!user) return

    try {
      const response = await fetch("/api/user/status")
      if (response.ok) {
        const data = await response.json()
        setStatusState(data.status)
        setEffective(data.effective)
      }
    } catch (error) {
      console.error("[useUserStatus] Fetch error:", error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Initial fetch and polling
  useEffect(() => {
    if (!user) {
      setStatusState(null)
      setEffective(null)
      setLoading(false)
      return
    }

    fetchStatus()

    // Poll for status updates (e.g., focus mode expiration)
    intervalRef.current = setInterval(fetchStatus, STATUS_POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user, fetchStatus])

  // Update status
  const updateStatus = useCallback(async (updates: UpdateStatusRequest): Promise<boolean> => {
    setUpdating(true)
    try {
      const response = await fetch("/api/user/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setStatusState(data.status)
        setEffective(data.effective)
        return true
      }
      return false
    } catch (error) {
      console.error("[useUserStatus] Update error:", error)
      return false
    } finally {
      setUpdating(false)
    }
  }, [])

  // Quick status setters
  const setOnline = useCallback(() => updateStatus({ status: "online" }), [updateStatus])
  const setAway = useCallback(() => updateStatus({ status: "away" }), [updateStatus])
  const setBusy = useCallback(() => updateStatus({ status: "busy" }), [updateStatus])
  const setDND = useCallback(() => updateStatus({ status: "dnd" }), [updateStatus])
  const setOffline = useCallback(() => updateStatus({ status: "offline" }), [updateStatus])

  // Custom message
  const setCustomMessage = useCallback(
    (message: string, expiresInMinutes?: number) => {
      const expiresAt = expiresInMinutes !== undefined ? calculateExpiration(expiresInMinutes) : null
      return updateStatus({
        custom_message: message,
        custom_message_expires_at: expiresAt,
      })
    },
    [updateStatus]
  )

  const clearCustomMessage = useCallback(() => {
    return updateStatus({
      custom_message: null,
      custom_message_expires_at: null,
    })
  }, [updateStatus])

  // Focus mode
  const enableFocusMode = useCallback(
    (expiresInMinutes?: number) => {
      const expiresAt = expiresInMinutes ? calculateExpiration(expiresInMinutes) : null
      return updateStatus({
        focus_mode_enabled: true,
        focus_mode_expires_at: expiresAt,
        status: "dnd",
      })
    },
    [updateStatus]
  )

  const disableFocusMode = useCallback(() => {
    return updateStatus({
      focus_mode_enabled: false,
      focus_mode_expires_at: null,
      status: "online",
    })
  }, [updateStatus])

  // Combined setter for status + message + duration
  const setStatusWithMessage = useCallback(
    (
      newStatus: UserStatusType,
      message?: string,
      messageExpiresInMinutes?: number,
      focusMode?: boolean,
      focusModeExpiresInMinutes?: number
    ) => {
      const updates: UpdateStatusRequest = { status: newStatus }

      if (message !== undefined) {
        updates.custom_message = message || null
        updates.custom_message_expires_at =
          messageExpiresInMinutes !== undefined ? calculateExpiration(messageExpiresInMinutes) : null
      }

      if (focusMode !== undefined) {
        updates.focus_mode_enabled = focusMode
        updates.focus_mode_expires_at =
          focusMode && focusModeExpiresInMinutes
            ? calculateExpiration(focusModeExpiresInMinutes)
            : null
      }

      return updateStatus(updates)
    },
    [updateStatus]
  )

  return {
    // State
    status,
    effective,
    loading,
    updating,

    // Actions
    updateStatus,
    setOnline,
    setAway,
    setBusy,
    setDND,
    setOffline,
    setCustomMessage,
    clearCustomMessage,
    enableFocusMode,
    disableFocusMode,
    setStatusWithMessage,

    // Refresh
    refresh: fetchStatus,
  }
}

// ----------------------------------------------------------------------------
// useOtherUserStatus - Get status for other users
// ----------------------------------------------------------------------------

export function useOtherUserStatus(userIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, EffectiveUserStatus>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (userIds.length === 0) {
      setStatuses({})
      return
    }

    const fetchStatuses = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/user/status?ids=${userIds.join(",")}`)
        if (response.ok) {
          const data = await response.json()
          setStatuses(data.statuses || {})
        }
      } catch (error) {
        console.error("[useOtherUserStatus] Fetch error:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatuses()

    // Poll for updates
    const interval = setInterval(fetchStatuses, STATUS_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [userIds.join(",")])

  return { statuses, loading }
}

// ----------------------------------------------------------------------------
// useFocusMode - Focused interface for focus mode
// ----------------------------------------------------------------------------

export function useFocusMode() {
  const { effective, enableFocusMode, disableFocusMode, loading, updating } = useUserStatus()

  return {
    isEnabled: effective?.focus_mode_enabled ?? false,
    enable: enableFocusMode,
    disable: disableFocusMode,
    toggle: (expiresInMinutes?: number) => {
      if (effective?.focus_mode_enabled) {
        return disableFocusMode()
      }
      return enableFocusMode(expiresInMinutes)
    },
    loading,
    updating,
  }
}
