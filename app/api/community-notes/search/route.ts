"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"

export interface VideoItem {
  id: string
  url: string
  title?: string
  description?: string
  duration?: string
  thumbnail?: string
  platform?: "youtube" | "vimeo" | "rumble"
  embed_id?: string
  embed_url?: string
}

export interface ImageItem {
  id: string
  url: string
  alt?: string
  caption?: string
  size?: number
  width?: number
  height?: number
  format?: string
}

export interface Reply {
  id: string
  note_id: string
  user_id: string
  content: string
  color: string
  created_at: string
  updated_at: string
  user?: any
}

export interface Note {
  id: string
  user_id: string
  title: string
  topic?: string
  content: string
  color: string
  position_x: number
  position_y: number
  is_shared: boolean
  tags: string[]
  videos: VideoItem[]
  images: ImageItem[]
  tabs?: any[]
  replies?: Reply[]
  created_at: string
  updated_at: string
  z_index?: number
  hyperlinks?: { url: string; title?: string }[]
}

const DEFAULT_LIMIT = 20

function extractTabTags(tab: any, tagsOut: string[]): void {
  if (!tab.tags) return
  try {
    const tabTags = typeof tab.tags === "string" ? JSON.parse(tab.tags) : tab.tags
    if (Array.isArray(tabTags)) {
      const stringTags = tabTags.filter((tag: any) => typeof tag === "string").map(String)
      tagsOut.push(...stringTags)
    }
  } catch (e) {
    console.warn("Failed to parse tab tags:", e)
  }
}

function extractTabMedia(tab: any, videosOut: VideoItem[], imagesOut: ImageItem[]): void {
  if (!tab.tab_data) return
  try {
    const tabData = typeof tab.tab_data === "string" ? JSON.parse(tab.tab_data) : tab.tab_data
    if (Array.isArray(tabData.videos)) videosOut.push(...tabData.videos)
    if (Array.isArray(tabData.images)) imagesOut.push(...tabData.images)
  } catch (e) {
    console.warn("Failed to parse tab_data:", e)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get("q") || ""
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT))
    const offset = (page - 1) * limit

    const db = await createServiceDatabaseClient()

    // Build query
    let query = db
      .from("notes")
      .select(`
        id, topic, content, color, position_x, position_y, is_shared,
        created_at, updated_at, user_id, z_index
      `)
      .eq("is_shared", true)

    let countQuery = db
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("is_shared", true)

    // Apply search filter
    if (searchTerm) {
      if (searchTerm.includes(":")) {
        const topicKeywords = searchTerm
          .split(":")
          .map((word) => word.trim())
          .filter((word) => word.length > 0)

        topicKeywords.forEach((keyword) => {
          query = query.ilike("topic", `%${keyword}%`)
          countQuery = countQuery.ilike("topic", `%${keyword}%`)
        })
      } else {
        query = query.ilike("topic", `%${searchTerm}%`)
        countQuery = countQuery.ilike("topic", `%${searchTerm}%`)
      }
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

    const [{ data: notes, error: notesError }, { count }] = await Promise.all([query, countQuery])

    if (notesError) {
      console.error("Search notes error:", notesError)
      return NextResponse.json({ error: "Failed to search notes" }, { status: 500 })
    }

    const noteIds = notes?.map((note: any) => note.id) || []

    // Fetch replies and note tabs
    const [repliesResult, noteTabsResult] = await Promise.all([
      noteIds.length > 0
        ? db
            .from("replies")
            .select("id, note_id, user_id, content, color, created_at, updated_at")
            .in("note_id", noteIds)
        : { data: [], error: null },
      noteIds.length > 0
        ? db
            .from("note_tabs")
            .select("id, note_id, tab_type, tab_data, tags, created_at, updated_at")
            .in("note_id", noteIds)
        : { data: [], error: null },
    ])

    if (repliesResult.error) {
      console.error("Search replies error:", repliesResult.error)
    }
    if (noteTabsResult.error) {
      console.error("Search note_tabs error:", noteTabsResult.error)
    }

    // Group by note_id
    const repliesByNoteId = new Map<string, any[]>()
    for (const reply of (repliesResult.data || [])) {
      const arr = repliesByNoteId.get(reply.note_id) || []
      arr.push(reply)
      repliesByNoteId.set(reply.note_id, arr)
    }

    const noteTabsByNoteId = new Map<string, any[]>()
    for (const tab of (noteTabsResult.data || [])) {
      const arr = noteTabsByNoteId.get(tab.note_id) || []
      arr.push(tab)
      noteTabsByNoteId.set(tab.note_id, arr)
    }

    // Process notes
    const processedNotes: Note[] = (notes || []).map((note: any) => {
      const noteTabs = noteTabsByNoteId.get(note.id) || []
      const tabVideos: VideoItem[] = []
      const tabImages: ImageItem[] = []
      const tagsFromNoteTabs: string[] = []

      noteTabs.forEach((tab: any) => {
        extractTabTags(tab, tagsFromNoteTabs)
        extractTabMedia(tab, tabVideos, tabImages)
      })

      const allTags = [...new Set(tagsFromNoteTabs)].filter((tag) => typeof tag === "string" && tag.trim().length > 0)
      const noteReplies = repliesByNoteId.get(note.id) || []
      const replies: Reply[] = noteReplies.map((reply: any) => ({
        id: reply.id,
        note_id: reply.note_id,
        user_id: reply.user_id,
        content: reply.content,
        color: reply.color,
        created_at: reply.created_at,
        updated_at: reply.updated_at || reply.created_at,
      }))

      const hyperlinks = allTags.map((tag) => ({
        url: `#tag-${encodeURIComponent(tag)}`,
        title: tag,
      }))

      return {
        id: note.id,
        user_id: note.user_id,
        title: note.topic || "",
        topic: note.topic || undefined,
        content: note.content || "",
        color: note.color,
        position_x: note.position_x ?? 0,
        position_y: note.position_y ?? 0,
        is_shared: note.is_shared,
        tags: allTags,
        videos: tabVideos,
        images: tabImages,
        tabs: noteTabs,
        replies: replies,
        created_at: note.created_at,
        updated_at: note.updated_at,
        z_index: note.z_index ?? undefined,
        hyperlinks: hyperlinks.length > 0 ? hyperlinks : undefined,
      }
    })

    return NextResponse.json({
      notes: processedNotes,
      totalCount: count || 0,
      hasMore: (count || 0) > page * limit,
      page,
    })
  } catch (error) {
    console.error("Error searching community notes:", error)
    return NextResponse.json({ error: "Failed to search notes" }, { status: 500 })
  }
}
