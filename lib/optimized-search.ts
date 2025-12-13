import { createSupabaseBrowser } from "@/lib/supabase-browser"

export interface Note {
  id: string
  user_id: string
  title: string // required by DB
  topic?: string
  content: string
  color: string
  position_x: number
  position_y: number
  is_shared: boolean
  tags: string[]
  videos: VideoItem[]
  images: ImageItem[]
  tabs?: NoteTab[]
  replies?: Reply[]
  created_at: string
  updated_at: string
  z_index?: number
  hyperlinks?: { url: string; title?: string }[]
}

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

export interface NoteTab {
  id: string
  note_id: string
  tab_type: "main" | "videos" | "images" | "details"
  tab_data?: any
  videos?: VideoItem[]
  images?: ImageItem[]
  created_at: string
  updated_at: string
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

export interface SearchOptions {
  page?: number
  limit?: number
  userId?: string
}

export interface SearchResult {
  notes: Note[]
  totalCount: number
  hasMore: boolean
  page: number
}

export class OptimizedSearch {
  private static DEFAULT_LIMIT = 20

  static async searchCommunityNotes(searchTerm: string, options: SearchOptions = {}): Promise<SearchResult> {
    const { page = 1, limit = this.DEFAULT_LIMIT } = options

    const supabase = createSupabaseBrowser()
    const offset = (page - 1) * limit

    try {
      const { count: totalNotes, error: totalError } = await supabase
        .from("notes")
        .select("id", { count: "exact", head: true })

      let allMatchingQuery = supabase.from("notes").select("id", { count: "exact", head: true })

      if (searchTerm.includes(":")) {
        const topicKeywords = searchTerm
          .split(":")
          .map((word) => word.trim())
          .filter((word) => word.length > 0)

        topicKeywords.forEach((keyword) => {
          allMatchingQuery = allMatchingQuery.ilike("topic", `%${keyword}%`)
        })
      } else {
        allMatchingQuery = allMatchingQuery.ilike("topic", `%${searchTerm}%`)
      }

      const { count: allMatchingCount, error: allMatchingError } = await allMatchingQuery

      const { count: sharedNotes, error: sharedError } = await supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("is_shared", true)

      let query = supabase
        .from("notes")
        .select(`
          id, topic, content, color, position_x, position_y, is_shared,
          created_at, updated_at, user_id, z_index
        `)
        .eq("is_shared", true)

      let countQuery = supabase.from("notes").select("id", { count: "exact", head: true }).eq("is_shared", true)

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

      query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

      const [{ data: notes, error: notesError }, { count, error: countError }] = await Promise.all([query, countQuery])

      if (notesError) {
        throw notesError
      }
      if (countError) {
        throw countError
      }

      const noteIds = notes?.map((note: any) => note.id) || []

      const [repliesResult, noteTabsResult] = await Promise.all([
        noteIds.length > 0
          ? supabase
              .from("replies")
              .select("id, note_id, user_id, content, color, created_at, updated_at")
              .in("note_id", noteIds)
          : { data: [], error: null },
        noteIds.length > 0
          ? supabase
              .from("note_tabs")
              .select("id, note_id, tab_type, tab_data, tags, created_at, updated_at")
              .in("note_id", noteIds)
          : { data: [], error: null },
      ])

      if (repliesResult.error) {
        console.error("[v0] OptimizedSearch replies error:", repliesResult.error)
      }
      if (noteTabsResult.error) {
        console.error("[v0] OptimizedSearch note_tabs error:", noteTabsResult.error)
      }

      const repliesByNoteId = (repliesResult.data || []).reduce((acc: any, reply: any) => {
        if (!acc[reply.note_id]) acc[reply.note_id] = []
        acc[reply.note_id].push(reply)
        return acc
      }, {})

      const noteTabsByNoteId = (noteTabsResult.data || []).reduce((acc: any, tab: any) => {
        if (!acc[tab.note_id]) acc[tab.note_id] = []
        acc[tab.note_id].push(tab)
        return acc
      }, {})

      const processedNotes: Note[] = (notes || []).map((note: any) => {
        const noteTabs = noteTabsByNoteId[note.id] || []
        const tabVideos: VideoItem[] = []
        const tabImages: ImageItem[] = []
        const tagsFromNoteTabs: string[] = []

        noteTabs.forEach((tab: any) => {
          if (tab.tags) {
            try {
              const tabTags = typeof tab.tags === "string" ? JSON.parse(tab.tags) : tab.tags
              if (Array.isArray(tabTags)) {
                const stringTags = tabTags.filter((tag) => typeof tag === "string").map((tag) => String(tag))
                tagsFromNoteTabs.push(...stringTags)
              }
            } catch (e) {
              console.warn("[v0] Failed to parse tab tags:", e)
            }
          }

          if (tab.tab_data) {
            try {
              const tabData = typeof tab.tab_data === "string" ? JSON.parse(tab.tab_data) : tab.tab_data
              if (tabData.videos && Array.isArray(tabData.videos)) {
                tabVideos.push(...tabData.videos)
              }
              if (tabData.images && Array.isArray(tabData.images)) {
                tabImages.push(...tabData.images)
              }
            } catch (e) {
              console.warn("[v0] Failed to parse tab_data:", e)
            }
          }
        })

        const allTags = [...new Set(tagsFromNoteTabs)].filter((tag) => typeof tag === "string" && tag.trim().length > 0)
        const allVideos = tabVideos
        const allImages = tabImages

        const noteReplies = repliesByNoteId[note.id] || []
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
          videos: allVideos,
          images: allImages,
          tabs: noteTabs,
          replies: replies,
          created_at: note.created_at,
          updated_at: note.updated_at,
          z_index: note.z_index ?? undefined,
          hyperlinks: hyperlinks.length > 0 ? hyperlinks : undefined,
        }
      })

      const result = {
        notes: processedNotes,
        totalCount: count || 0,
        hasMore: (count || 0) > page * limit,
        page,
      }

      return result
    } catch (error) {
      throw error
    }
  }
}
