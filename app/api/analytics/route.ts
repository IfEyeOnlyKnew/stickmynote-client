"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

interface NoteRecord {
  id: string
  created_at: string
  is_shared: boolean
}

const MS_PER_DAY = 86400000
const DAYS_IN_WEEK = 7
const DAYS_IN_MONTH = 30

// Helper: Calculate the most active day from notes
function calculateMostActiveDay(notes: NoteRecord[]): string {
  const dayActivity = new Map<string, number>()
  for (const note of notes) {
    const day = new Date(note.created_at).toLocaleDateString("en-US", { weekday: "long" })
    dayActivity.set(day, (dayActivity.get(day) || 0) + 1)
  }
  const sorted = Array.from(dayActivity.entries()).sort(([, a], [, b]) => b - a)
  return sorted[0]?.[0] || "Monday"
}

// Helper: Calculate average notes per day
function calculateAverageNotesPerDay(notes: NoteRecord[], now: Date): number {
  if (notes.length === 0) return 0
  const firstNoteDate = new Date(notes.at(-1)?.created_at || now)
  const daysDiff = Math.max(1, Math.ceil((now.getTime() - firstNoteDate.getTime()) / MS_PER_DAY))
  return Math.round((notes.length / daysDiff) * 10) / 10
}

// Helper: Get unique sorted dates from notes
function getUniqueSortedDates(notes: NoteRecord[]): string[] {
  const dateSet = new Set(notes.map((n) => new Date(n.created_at).toDateString()))
  return Array.from(dateSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
}

// Helper: Calculate current streak
function calculateCurrentStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0
  
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - MS_PER_DAY).toDateString()
  
  const isRecent = sortedDates[0] === today || sortedDates[0] === yesterday
  if (!isRecent) return 0
  
  let streak = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = Math.floor(
      (new Date(sortedDates[i - 1]).getTime() - new Date(sortedDates[i]).getTime()) / MS_PER_DAY
    )
    if (diffDays === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// Helper: Calculate longest streak
function calculateLongestStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0
  
  let longest = 1
  let current = 1
  
  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = Math.floor(
      (new Date(sortedDates[i - 1]).getTime() - new Date(sortedDates[i]).getTime()) / MS_PER_DAY
    )
    if (diffDays === 1) {
      current++
    } else {
      longest = Math.max(longest, current)
      current = 1
    }
  }
  return Math.max(longest, current)
}

// Helper: Fetch likes count
async function fetchLikesCount(db: any, noteIds: string[]): Promise<number> {
  if (noteIds.length === 0) return 0
  const { count } = await db
    .from("personal_sticks_reactions")
    .select("*", { count: "exact", head: true })
    .in("personal_stick_id", noteIds)
    .eq("reaction_type", "like")
  return count || 0
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const db = await createServiceDatabaseClient()

    // Fetch notes
    const { data: notesRaw, error: notesError } = await db
      .from("personal_sticks")
      .select("id, created_at, is_shared")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (notesError) console.error("Error fetching notes:", notesError)
    const notes = (notesRaw ?? []) as NoteRecord[]

    // Fetch replies
    const { data: repliesRaw, error: repliesError } = await db
      .from("personal_sticks_replies")
      .select("id")
      .eq("user_id", user.id)

    if (repliesError) console.error("Error fetching replies:", repliesError)
    const replies = (repliesRaw ?? []) as { id: string }[]

    // Get likes count
    const noteIds = notes.map((n) => n.id)
    const totalLikes = await fetchLikesCount(db, noteIds)

    // Calculate time-based metrics
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - DAYS_IN_WEEK * MS_PER_DAY)
    const oneMonthAgo = new Date(now.getTime() - DAYS_IN_MONTH * MS_PER_DAY)

    const totalNotes = notes.length
    const sharedNotes = notes.filter((note) => note.is_shared).length
    const notesThisWeek = notes.filter((note) => new Date(note.created_at) >= oneWeekAgo).length
    const notesThisMonth = notes.filter((note) => new Date(note.created_at) >= oneMonthAgo).length

    // Calculate activity metrics
    const mostActiveDay = calculateMostActiveDay(notes)
    const averageNotesPerDay = calculateAverageNotesPerDay(notes, now)

    // Calculate streaks
    const sortedDates = getUniqueSortedDates(notes)
    const currentStreak = calculateCurrentStreak(sortedDates)
    const longestStreak = calculateLongestStreak(sortedDates)

    return NextResponse.json({
      analytics: {
        totalNotes,
        sharedNotes,
        privateNotes: totalNotes - sharedNotes,
        totalReplies: replies.length,
        notesThisWeek,
        notesThisMonth,
        averageNotesPerDay,
        mostActiveDay,
        longestStreak,
        currentStreak,
        totalLikes,
        totalViews: 0,
      },
    })
  } catch (error) {
    console.error("Error loading analytics:", error)
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 })
  }
}
