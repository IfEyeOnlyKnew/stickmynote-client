"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface UserProfile {
  username: string | null
  organize_notes: boolean
}

export function useUserProfile(userId: string | null) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  const refreshUserProfile = useCallback(async () => {
    if (!userId) return

    try {
      const supabase = createClient()

      const { data, error } = await supabase.from("users").select("username, organize_notes").eq("id", userId).single()

      if (error) {
        console.error("Error refreshing user profile:", error)
        return
      }

      const typedData = data as { username: string | null; organize_notes: boolean | null }

      setUserProfile({
        username: typedData.username,
        organize_notes: typedData.organize_notes ?? false,
      })
    } catch (err) {
      console.error("Error refreshing user profile:", err)
    }
  }, [userId])

  const updateOrganizePreference = useCallback(
    async (organizeNotes: boolean) => {
      if (!userId) return

      try {
        const supabase = createClient()
        const { error } = await (supabase as any)
          .from("users")
          .update({ organize_notes: organizeNotes })
          .eq("id", userId)

        if (error) {
          console.error("Error updating organize preference:", error)
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
        const supabase = createClient()

        let retryCount = 0
        const maxRetries = 4

        while (retryCount < maxRetries) {
          const { data, error } = await supabase
            .from("users")
            .select("username, organize_notes")
            .eq("id", userId)
            .maybeSingle()

          const typedData = data as { username: string | null; organize_notes: boolean | null } | null

          if (error && error.code !== "PGRST116") {
            if (error.code === "42501" || error.message?.includes("policy")) {
              console.log("RLS policy temporarily blocking access, retrying...")
            } else {
              console.error("Error loading user profile:", error)
              return
            }
          }

          if (typedData) {
            setUserProfile({
              username: typedData.username,
              organize_notes: typedData.organize_notes ?? false,
            })
            return
          }

          if (retryCount < maxRetries - 1) {
            const waitTime = 500 + retryCount * 300
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            retryCount++
          } else {
            console.log("Profile not found after retries, using defaults (RLS policies may need time to propagate)")
            setUserProfile({ username: null, organize_notes: false })
            return
          }
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
