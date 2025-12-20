"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/contexts/user-context"

export interface AnalyticsData {
  totalNotes: number
  sharedNotes: number
  privateNotes: number
  totalReplies: number
  notesThisWeek: number
  notesThisMonth: number
  averageNotesPerDay: number
  mostActiveDay: string
  longestStreak: number
  currentStreak: number
  totalLikes: number
  totalViews: number
}

export function useAnalytics() {
  const { user } = useUser()
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalNotes: 0,
    sharedNotes: 0,
    privateNotes: 0,
    totalReplies: 0,
    notesThisWeek: 0,
    notesThisMonth: 0,
    averageNotesPerDay: 0,
    mostActiveDay: "Monday",
    longestStreak: 0,
    currentStreak: 0,
    totalLikes: 0,
    totalViews: 0,
  })
  const [loading, setLoading] = useState(true)

  const loadAnalytics = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/analytics")
      if (!response.ok) {
        throw new Error("Failed to fetch analytics")
      }

      const data = await response.json()
      setAnalytics(data.analytics)
    } catch (error) {
      console.error("Error loading analytics:", error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  return { analytics, loading, refetch: loadAnalytics }
}
