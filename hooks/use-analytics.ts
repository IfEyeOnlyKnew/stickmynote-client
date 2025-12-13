"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/contexts/user-context"
import { createSupabaseBrowser } from "@/lib/supabase-browser"

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

interface NoteRecord {
  id: string
  created_at: string
  is_shared: boolean
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

  const calculateDayActivity = (notes: NoteRecord[]) => {
    const dayActivity = new Map<string, number>()
    notes?.forEach((note) => {
      const day = new Date(note.created_at).toLocaleDateString("en-US", {
        weekday: "long",
      })
      dayActivity.set(day, (dayActivity.get(day) || 0) + 1)
    })
    return dayActivity
  }

  const calculateAverageNotesPerDay = (notes: NoteRecord[], totalNotes: number) => {
    if (totalNotes === 0 || notes.length === 0) return 0

    const now = new Date()
    const firstNoteDate = new Date(notes[notes.length - 1]?.created_at || now)
    const daysDiff = Math.max(1, Math.ceil((now.getTime() - firstNoteDate.getTime()) / (24 * 60 * 60 * 1000)))

    return Math.round((totalNotes / daysDiff) * 10) / 10
  }

  const calculateStreaks = (notes: NoteRecord[]) => {
    if (notes.length === 0) return { longestStreak: 0, currentStreak: 0 }

    // Sort notes by date descending
    const sortedDates = notes
      .map((n) => new Date(n.created_at).toDateString())
      .filter((date, index, arr) => arr.indexOf(date) === index) // unique dates
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    if (sortedDates.length === 0) return { longestStreak: 0, currentStreak: 0 }

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 1

    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()

    // Check current streak
    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      currentStreak = 1
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1])
        const currDate = new Date(sortedDates[i])
        const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000)

        if (diffDays === 1) {
          currentStreak++
        } else {
          break
        }
      }
    }

    // Calculate longest streak
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1])
      const currDate = new Date(sortedDates[i])
      const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000)

      if (diffDays === 1) {
        tempStreak++
      } else {
        longestStreak = Math.max(longestStreak, tempStreak)
        tempStreak = 1
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)

    return { longestStreak, currentStreak }
  }

  const loadAnalytics = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const supabase = createSupabaseBrowser()

      const { data: notesRaw, error: notesError } = await supabase
        .from("personal_sticks")
        .select("id, created_at, is_shared")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (notesError) {
        console.error("Error fetching notes:", notesError)
      }
      const notes = (notesRaw ?? []) as NoteRecord[]

      const { data: repliesRaw, error: repliesError } = await supabase
        .from("personal_sticks_replies")
        .select("id")
        .eq("user_id", user.id)

      if (repliesError) {
        console.error("Error fetching replies:", repliesError)
      }
      const replies = (repliesRaw ?? []) as { id: string }[]

      const noteIds = notes.map((n) => n.id)
      let totalLikes = 0
      if (noteIds.length > 0) {
        const { count: likesCount } = await supabase
          .from("personal_sticks_reactions")
          .select("*", { count: "exact", head: true })
          .in("personal_stick_id", noteIds)
          .eq("reaction_type", "like")

        totalLikes = likesCount || 0
      }

      // Calculate time periods
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Calculate basic metrics
      const totalNotes = notes.length
      const sharedNotes = notes.filter((note) => note.is_shared).length
      const privateNotes = totalNotes - sharedNotes
      const totalReplies = replies.length

      const notesThisWeek = notes.filter((note) => new Date(note.created_at) >= oneWeekAgo).length
      const notesThisMonth = notes.filter((note) => new Date(note.created_at) >= oneMonthAgo).length

      // Calculate advanced metrics
      const dayActivity = calculateDayActivity(notes)
      const mostActiveDay = Array.from(dayActivity.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] || "Monday"
      const averageNotesPerDay = calculateAverageNotesPerDay(notes, totalNotes)
      const { longestStreak, currentStreak } = calculateStreaks(notes)

      setAnalytics({
        totalNotes,
        sharedNotes,
        privateNotes,
        totalReplies,
        notesThisWeek,
        notesThisMonth,
        averageNotesPerDay,
        mostActiveDay,
        longestStreak,
        currentStreak,
        totalLikes,
        totalViews: 0, // Views not tracked currently
      })
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
