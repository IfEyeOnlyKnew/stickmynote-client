"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const db = await createServiceDatabaseClient()

    // Fetch shared notes
    const { data: sharedNotes, error: notesError } = await db
      .from("personal_sticks")
      .select("id, topic, content, user_id, created_at, updated_at")
      .eq("is_shared", true)
      .order("created_at", { ascending: false })
      .limit(10)

    if (notesError) {
      console.error("Error fetching community notes:", notesError)
      return NextResponse.json({ notes: [] })
    }

    if (!sharedNotes || sharedNotes.length === 0) {
      return NextResponse.json({ notes: [] })
    }

    const noteIds = sharedNotes.map((n: { id: string }) => n.id)
    const userIds = [...new Set(sharedNotes.map((n: { user_id: string }) => n.user_id))]

    // Fetch related data in parallel
    const [tagsResult, repliesResult, reactionsResult, usersResult] = await Promise.all([
      db.from("personal_sticks_tags").select("personal_stick_id, tag").in("personal_stick_id", noteIds),
      db.from("personal_sticks_replies").select("personal_stick_id").in("personal_stick_id", noteIds),
      db.from("personal_sticks_reactions").select("personal_stick_id, user_id, reaction_type").in("personal_stick_id", noteIds),
      userIds.length > 0 ? db.from("users").select("id, email, display_name, avatar_url").in("id", userIds) : { data: [] },
    ])

    // Build lookup maps
    const tagsMap: Record<string, string[]> = {}
    for (const t of tagsResult.data || []) {
      if (!tagsMap[t.personal_stick_id]) tagsMap[t.personal_stick_id] = []
      tagsMap[t.personal_stick_id].push(t.tag)
    }

    const repliesCountMap: Record<string, number> = {}
    for (const r of repliesResult.data || []) {
      repliesCountMap[r.personal_stick_id] = (repliesCountMap[r.personal_stick_id] || 0) + 1
    }

    const reactionsMap: Record<string, { user_id: string; reaction_type: string }[]> = {}
    for (const r of reactionsResult.data || []) {
      if (!reactionsMap[r.personal_stick_id]) reactionsMap[r.personal_stick_id] = []
      reactionsMap[r.personal_stick_id].push({ user_id: r.user_id, reaction_type: r.reaction_type })
    }

    const usersMap: Record<string, { email: string; display_name?: string; avatar_url?: string }> = {}
    for (const u of usersResult.data || []) {
      usersMap[u.id] = { email: u.email, display_name: u.display_name, avatar_url: u.avatar_url }
    }

    // Transform to CommunityNote format
    const transformedNotes = sharedNotes.map(
      (note: { id: string; user_id: string; topic?: string; content?: string; created_at: string }) => {
        const userInfo = usersMap[note.user_id] || { email: "Unknown" }
        const tags = tagsMap[note.id] || []
        const repliesCount = repliesCountMap[note.id] || 0
        const reactions = reactionsMap[note.id] || []
        const likes = reactions.filter((r) => r.reaction_type === "like").length
        const isLiked = reactions.some((r) => r.user_id === user.id && r.reaction_type === "like")

        // Determine if trending (more than 5 likes or recent activity)
        const trending = likes > 5 || repliesCount > 3

        return {
          id: note.id,
          title: note.topic || "Untitled",
          content: note.content || "",
          author: userInfo.display_name || userInfo.email?.split("@")[0] || "Anonymous",
          authorId: note.user_id,
          avatar: userInfo.avatar_url || "/diverse-avatars.png",
          likes,
          comments: repliesCount,
          tags,
          isLiked,
          trending,
          createdAt: note.created_at,
        }
      },
    )

    return NextResponse.json({ notes: transformedNotes })
  } catch (error) {
    console.error("Error loading community notes:", error)
    return NextResponse.json({ notes: [] })
  }
}
