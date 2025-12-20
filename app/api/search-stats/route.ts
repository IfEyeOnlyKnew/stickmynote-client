"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

interface SearchHistoryRecord {
  query: string
  results_count: number
  created_at: string
}

interface TagRecord {
  tag_title: string | null
  tag_content: string | null
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await createServiceDatabaseClient()

    // Fetch search history stats
    const { data: searchHistory, error: searchError } = await db
      .from("search_history")
      .select("query, results_count, created_at")
      .order("created_at", { ascending: false })
      .limit(100)

    if (searchError) {
      console.error("Search history error:", searchError)
    }

    // Calculate popular queries
    const queryMap = new Map<string, number>()
    const typedSearchHistory = (searchHistory || []) as SearchHistoryRecord[]
    typedSearchHistory.forEach((search) => {
      if (search.query) {
        queryMap.set(search.query, (queryMap.get(search.query) || 0) + 1)
      }
    })
    const popularQueries = Array.from(queryMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Fetch community notes stats from personal_sticks
    const { data: notes, error: notesError } = await db
      .from("personal_sticks")
      .select("id, view_count, user_id")
      .eq("is_shared", true)

    if (notesError) {
      console.error("Notes error:", notesError)
    }

    // Fetch total likes from personal_sticks_reactions
    const { count: likesCount, error: likesError } = await db
      .from("personal_sticks_reactions")
      .select("*", { count: "exact", head: true })
      .eq("reaction_type", "like")

    if (likesError) {
      console.error("Likes error:", likesError)
    }

    // Fetch total replies from personal_sticks_replies
    const { count: repliesCount, error: repliesError } = await db
      .from("personal_sticks_replies")
      .select("*", { count: "exact", head: true })

    if (repliesError) {
      console.error("Replies error:", repliesError)
    }

    // Fetch trending tags from personal_sticks_tags
    const { data: tags, error: tagsError } = await db
      .from("personal_sticks_tags")
      .select("tag_title, tag_content")
      .limit(500)

    if (tagsError) {
      console.error("Tags error:", tagsError)
    }

    // Process tags
    const tagMap = new Map<string, number>()
    const typedTags = (tags || []) as TagRecord[]
    typedTags.forEach((tag) => {
      const tagValue = tag.tag_title || tag.tag_content
      if (tagValue) {
        tagMap.set(tagValue, (tagMap.get(tagValue) || 0) + 1)
      }
    })
    const trendingTags = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate views
    const typedNotes = (notes || []) as { id: string; view_count: number | null; user_id: string }[]
    const totalViews = typedNotes.reduce((sum, note) => sum + (note.view_count || 0), 0)

    // Top contributors
    const contributorMap = new Map<string, number>()
    typedNotes.forEach((note) => {
      contributorMap.set(note.user_id, (contributorMap.get(note.user_id) || 0) + 1)
    })

    // Fetch user names for top contributors
    const topContributorIds = Array.from(contributorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId]) => userId)

    let topContributors: { full_name: string; note_count: number }[] = []
    if (topContributorIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, full_name")
        .in("id", topContributorIds)

      if (users) {
        topContributors = topContributorIds.map((userId) => {
          const user = users.find((u: any) => u.id === userId)
          return {
            full_name: user?.full_name || "Anonymous",
            note_count: contributorMap.get(userId) || 0,
          }
        })
      }
    }

    // Recent activity
    const recentActivity = typedSearchHistory.slice(0, 5).map((search) => ({
      query: search.query || "",
      created_at: search.created_at,
      results_count: search.results_count || 0,
    }))

    return NextResponse.json({
      stats: {
        totalSearches: typedSearchHistory.length,
        totalResults: typedSearchHistory.reduce((sum, s) => sum + (s.results_count || 0), 0),
        popularQueries,
        totalNotes: typedNotes.length,
        totalLikes: likesCount || 0,
        totalViews,
        totalReplies: repliesCount || 0,
        trendingTags,
        recentActivity,
        topContributors,
      },
    })
  } catch (error) {
    console.error("Error fetching search stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
