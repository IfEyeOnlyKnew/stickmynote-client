import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    let recentSearches: string[] = []
    try {
      const { data: recentData } = await db
        .from("search_history")
        .select("query")
        .eq("user_id", user.id)
        .not("query", "is", null)
        .order("created_at", { ascending: false })
        .limit(10)

      if (recentData) {
        // Remove duplicates and limit to 5
        const queries: string[] = recentData.map((item) => String(item.query || '')).filter((q) => q.length > 0)
        recentSearches = Array.from(new Set(queries)).slice(0, 5)
      }
    } catch (error) {
      console.log("[v0] search_history table error:", error)
    }

    let trendingTags: string[] = []
    let availableTags: string[] = []

    try {
      const { data: sharedNotes } = await db.from("personal_sticks").select("id").eq("is_shared", true).limit(200)

      const sharedNoteIds = sharedNotes?.map((n) => n.id) || []

      if (sharedNoteIds.length > 0) {
        const { data: tabsData } = await db
          .from("personal_sticks_tabs")
          .select("tags, personal_stick_id")
          .in("personal_stick_id", sharedNoteIds)
          .not("tags", "is", null)

        if (tabsData) {
          const tagCounts = new Map<string, number>()
          const tagSet = new Set<string>()

          tabsData.forEach((tab: any) => {
            if (tab.tags) {
              let tagArray: string[] = []

              // Handle both string array and JSON array formats
              if (Array.isArray(tab.tags)) {
                tagArray = tab.tags
              } else if (typeof tab.tags === "string") {
                try {
                  tagArray = JSON.parse(tab.tags)
                } catch {
                  tagArray = []
                }
              } else if (typeof tab.tags === "object") {
                // Handle jsonb object format
                tagArray = Object.values(tab.tags).filter((t): t is string => typeof t === "string")
              }

              tagArray.forEach((tag: any) => {
                const tagStr = typeof tag === "string" ? tag : tag?.name || ""
                if (tagStr) {
                  tagSet.add(tagStr)
                  tagCounts.set(tagStr, (tagCounts.get(tagStr) || 0) + 1)
                }
              })
            }
          })

          // Get trending tags (sorted by count)
          trendingTags = Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag]) => tag)

          // Get all available tags (sorted alphabetically)
          availableTags = Array.from(tagSet).sort()
        }
      }
    } catch (error) {
      console.log("[v0] Error fetching tags from personal_sticks_tabs:", error)
    }

    return NextResponse.json({
      recent: recentSearches,
      trending: trendingTags,
      tags: availableTags,
    })
  } catch (error) {
    console.error("[v0] Error fetching search suggestions:", error)
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 })
  }
}
