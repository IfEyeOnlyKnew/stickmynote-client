"use client"

import { useState, useEffect, useCallback } from "react"

interface UserProfile {
  username: string | null
  organize_notes: boolean
}

export function useUserProfile(userId: string | null) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  const refreshUserProfile = useCallback(async () => {
    if (!userId) return

    try {
      const response = await fetch("/api/user/me", {
        credentials: "include",
      })

      if (!response.ok) {
        console.error("Error refreshing user profile:", response.statusText)
        return
      }

      const data = await response.json()
      if (data.profile) {
        setUserProfile({
          username: data.profile.username || null,
          organize_notes: data.profile.organize_notes ?? false,
        })
      }
    } catch (err) {
      console.error("Error refreshing user profile:", err)
    }
  }, [userId])

  const updateOrganizePreference = useCallback(
    async (organizeNotes: boolean) => {
      if (!userId) return

      try {
        const response = await fetch("/api/user/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ organize_notes: organizeNotes }),
        })

        if (!response.ok) {
          console.error("Error updating organize preference:", response.statusText)
          return
        }

        // Update local state
        setUserProfile((prev) => (prev ? { ...prev, organize_notes: organizeNotes } : null))
      } catch (err) {
        console.error("Error updating organize preference:", err)
      }
    },
    [userId],
  )

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!userId) return

      try {
        const response = await fetch("/api/user/me", {
          credentials: "include",
        })

        if (!response.ok) {
          // User might not be authenticated yet
          if (response.status !== 401) {
            console.error("Error loading user profile:", response.statusText)
          }
          setUserProfile({ username: null, organize_notes: false })
          return
        }

        const data = await response.json()
        if (data.profile) {
          setUserProfile({
            username: data.profile.username || null,
            organize_notes: data.profile.organize_notes ?? false,
          })
        } else {
          setUserProfile({ username: null, organize_notes: false })
        }
      } catch (err) {
        console.error("Error loading user profile:", err)
        setUserProfile({ username: null, organize_notes: false })
      }
    }

    if (userId) {
      loadUserProfile()
    }
  }, [userId])

  return { userProfile, refreshUserProfile, updateOrganizePreference }
}
