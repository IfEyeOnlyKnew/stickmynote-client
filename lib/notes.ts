import { createClient } from "@/lib/supabase/client"
import type { Note as BaseNote, Reply, VideoItem, ImageItem } from "@/types/note"

// Extend Note type to include 'tags', 'images', 'videos', and 'replies' if not present
export interface Note extends BaseNote {
  tags: string[]
  images: ImageItem[]
  videos: VideoItem[]
  replies: Reply[]
}

// ============================================================================
// TYPES
// ============================================================================

export interface CreateNoteData {
  topic?: string
  content: string
  color?: string
  position_x?: number
  position_y?: number
  is_shared?: boolean
  tags?: string[]
  images?: string[]
  videos?: string[]
}

export interface UpdateNoteData extends Partial<CreateNoteData> {
  id: string
}

export interface CreateReplyData {
  note_id: string
  content: string
  color?: string
}

export interface NotesResponse {
  notes: Note[]
  hasMore: boolean
  total: number
}

interface DatabaseNoteRow {
  id: string
  user_id: string
  title: string | null
  topic: string | null
  content: string
  color: string
  position_x: number
  position_y: number
  is_shared: boolean
  z_index: number | null
  is_pinned: boolean | null
  created_at: string
  updated_at: string
}

interface DatabaseReplyRow {
  id: string
  personal_stick_id: string // Renamed from note_id
  user_id: string
  content: string
  color: string
  created_at: string
  updated_at: string
}

interface ReplyInsertPayload {
  personal_stick_id: string // Renamed from note_id
  content: string
  color: string
  created_at: string
  updated_at: string
  user_id: string
}

// ============================================================================
// NOTES FUNCTIONS
// ============================================================================

/**
 * Get all personal sticks (notes) for the current user
 */
export async function getNotes(
  limit = 20,
  offset = 0,
  filter: "all" | "personal" | "shared" = "all",
): Promise<NotesResponse> {
  try {
    const supabase = createClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Authentication error:", authError)
      throw new Error("User not authenticated")
    }

    let notesQuery = supabase
      .from("personal_sticks")
      .select(
        `
        id,
        title,
        topic,
        content,
        color,
        position_x,
        position_y,
        is_shared,
        z_index,
        is_pinned,
        created_at,
        updated_at,
        user_id
      `,
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (filter === "personal") {
      notesQuery = notesQuery.eq("is_shared", false)
    } else if (filter === "shared") {
      notesQuery = notesQuery.eq("is_shared", true)
    }

    notesQuery = notesQuery.range(offset, offset + limit - 1)

    const { data: notes, error: notesError } = await notesQuery

    if (notesError) {
      console.error("Database error fetching notes:", notesError)
      throw new Error(`Failed to fetch notes: ${notesError.message}`)
    }

    const notesWithReplies: Note[] = []

    for (const note of (notes || []) as DatabaseNoteRow[]) {
      const { data: replies, error: repliesError } = await supabase
        .from("personal_sticks_replies")
        .select(
          `
          id,
          content,
          color,
          created_at,
          updated_at,
          user_id,
          personal_stick_id
        `,
        )
        .eq("personal_stick_id", note.id)
        .order("created_at", { ascending: true })

      if (repliesError) {
        console.error("Error fetching replies for note:", note.id, repliesError)
      }

      const typedReplies = (replies || []) as DatabaseReplyRow[]

      // Changed from "note_tabs" to "personal_sticks_tabs"
      const { data: noteTabs } = await supabase
        .from("personal_sticks_tabs")
        .select("*")
        .eq("personal_stick_id", note.id)
        .eq("user_id", user.id)

      let tags: string[] = []
      let images: ImageItem[] = []
      let videos: VideoItem[] = []

      if (noteTabs) {
        for (const tab of noteTabs as any[]) {
          if (tab.tab_data) {
            const tabData = typeof tab.tab_data === "string" ? JSON.parse(tab.tab_data) : tab.tab_data
            if (tabData.tags && Array.isArray(tabData.tags)) {
              tags = [...tags, ...tabData.tags]
            }
            if (tabData.images && Array.isArray(tabData.images)) {
              images = [...images, ...tabData.images]
            }
            if (tabData.videos && Array.isArray(tabData.videos)) {
              videos = [...videos, ...tabData.videos]
            }
          }
        }
      }

      const transformedNote: Note = {
        id: note.id,
        title: note.title || note.topic || "Untitled Note",
        topic: note.topic || "",
        content: note.content || "",
        color: note.color || "#fef3c7",
        position_x: note.position_x || 0,
        position_y: note.position_y || 0,
        is_shared: Boolean(note.is_shared),
        z_index: note.z_index || undefined,
        is_pinned: note.is_pinned || undefined,
        tags: tags,
        images: images,
        videos: videos,
        created_at: note.created_at,
        updated_at: note.updated_at,
        user_id: note.user_id,
        replies: typedReplies.map((reply) => ({
          id: reply.id,
          content: reply.content || "",
          color: reply.color || "#ffffff",
          created_at: reply.created_at,
          updated_at: reply.updated_at || reply.created_at,
          user_id: reply.user_id,
          note_id: reply.personal_stick_id, // Keep note_id for backwards compatibility
        })),
      }

      notesWithReplies.push(transformedNote)
    }

    const { count: totalCount } = await supabase
      .from("personal_sticks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    return {
      notes: notesWithReplies,
      hasMore: (notes?.length || 0) === limit,
      total: totalCount || 0,
    }
  } catch (error) {
    console.error("Error in getNotes:", error)
    throw error
  }
}

/**
 * Create a new personal stick (note)
 */
export async function createNote(noteData: CreateNoteData): Promise<Note> {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Authentication error:", authError)
      throw new Error("User not authenticated")
    }

    interface NotesInsertPayload {
      user_id: string
      title: string
      topic: string
      content: string
      color: string
      position_x: number
      position_y: number
      is_shared: boolean
      z_index?: number
      is_pinned?: boolean
    }

    const noteToCreate: NotesInsertPayload = {
      user_id: user.id,
      title: noteData.topic || "Untitled Note",
      topic: noteData.topic || "",
      content: noteData.content || "",
      color: noteData.color || "#fef3c7",
      position_x: noteData.position_x || 0,
      position_y: noteData.position_y || 0,
      is_shared: Boolean(noteData.is_shared),
      z_index: 1,
      is_pinned: false,
    }

    const { data: noteRaw, error } = await (supabase as any)
      .from("personal_sticks")
      .insert([noteToCreate])
      .select(
        `
        id,
        title,
        topic,
        content,
        color,
        position_x,
        position_y,
        is_shared,
        z_index,
        is_pinned,
        created_at,
        updated_at,
        user_id
      `,
      )
      .single()

    const note = noteRaw as DatabaseNoteRow | null

    if (error) {
      console.error("Database error creating note:", error)
      throw new Error(`Failed to create note: ${error.message}`)
    }

    if (!note) {
      throw new Error("Note was not created")
    }

    if (noteData.tags || noteData.images || noteData.videos) {
      const tabData = {
        tags: noteData.tags || [],
        images: noteData.images || [],
        videos: noteData.videos || [],
      }

      // Changed from "note_tabs" to "personal_sticks_tabs", note_id to personal_stick_id
      await (supabase as any).from("personal_sticks_tabs").insert([
        {
          personal_stick_id: note.id,
          user_id: user.id,
          tab_type: "main",
          tab_name: "Main",
          tab_content: "",
          tab_data: tabData,
          tab_order: 1,
        },
      ])
    }

    const transformedNote: Note = {
      id: note.id,
      title: note.title || note.topic || "Untitled Note",
      topic: note.topic || "",
      content: note.content || "",
      color: note.color || "#fef3c7",
      position_x: note.position_x || 0,
      position_y: note.position_y || 0,
      is_shared: Boolean(note.is_shared),
      z_index: note.z_index || undefined,
      is_pinned: note.is_pinned || undefined,
      tags: noteData.tags || [],
      images: [],
      videos: [],
      created_at: note.created_at,
      updated_at: note.updated_at,
      user_id: note.user_id,
      replies: [],
    }

    return transformedNote
  } catch (error) {
    console.error("Error in createNote:", error)
    throw error
  }
}

/**
 * Update an existing personal stick (note)
 */
export async function updateNote(noteData: UpdateNoteData): Promise<Note> {
  try {
    const supabase = createClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Authentication error:", authError)
      throw new Error("User not authenticated")
    }

    const { id, ...updateData } = noteData

    const updatePayload: Partial<{
      title: string
      topic: string
      content: string
      color: string
      position_x: number
      position_y: number
      is_shared: boolean
      z_index: number
      is_pinned: boolean
      updated_at: string
    }> = {
      updated_at: new Date().toISOString(),
    }

    if (updateData.topic !== undefined) {
      updatePayload.topic = updateData.topic
      updatePayload.title = updateData.topic || "Untitled Note"
    }
    if (updateData.content !== undefined) updatePayload.content = updateData.content
    if (updateData.color !== undefined) updatePayload.color = updateData.color
    if (updateData.position_x !== undefined) updatePayload.position_x = updateData.position_x
    if (updateData.position_y !== undefined) updatePayload.position_y = updateData.position_y
    if (updateData.is_shared !== undefined) updatePayload.is_shared = Boolean(updateData.is_shared)

    const { data: noteRaw, error } = await (supabase as any)
      .from("personal_sticks")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(
        `
        id,
        title,
        topic,
        content,
        color,
        position_x,
        position_y,
        is_shared,
        z_index,
        is_pinned,
        created_at,
        updated_at,
        user_id
      `,
      )
      .single()

    const note = (noteRaw ?? {}) as Partial<Note>

    if (error) {
      console.error("Database error updating note:", error)
      throw new Error(`Failed to update note: ${error.message}`)
    }

    if (!note) {
      throw new Error("Note not found or you don't have permission to update it")
    }

    if (updateData.tags || updateData.images || updateData.videos) {
      const tabData = {
        tags: updateData.tags || [],
        images: updateData.images || [],
        videos: updateData.videos || [],
      }

      // Changed from "note_tabs" to "personal_sticks_tabs", note_id to personal_stick_id
      const { data: existingTab } = await (supabase as any)
        .from("personal_sticks_tabs")
        .select("id")
        .eq("personal_stick_id", id)
        .eq("user_id", user.id)
        .eq("tab_type", "main")
        .single()

      if (existingTab && existingTab.id) {
        await (supabase as any)
          .from("personal_sticks_tabs")
          .update({ tab_data: tabData, updated_at: new Date().toISOString() })
          .eq("id", existingTab.id)
      } else {
        await (supabase as any).from("personal_sticks_tabs").insert([
          {
            personal_stick_id: id,
            user_id: user.id,
            tab_type: "main",
            tab_name: "Main",
            tab_content: "",
            tab_data: tabData,
            tab_order: 1,
          },
        ])
      }
    }

    const { data: repliesData } = await supabase
      .from("personal_sticks_replies")
      .select(
        `
        id,
        content,
        color,
        created_at,
        updated_at,
        user_id,
        personal_stick_id
      `,
      )
      .eq("personal_stick_id", typeof note.id === "string" && note.id ? note.id : "")
      .order("created_at", { ascending: true })
    const replies = repliesData || []

    // Changed from "note_tabs" to "personal_sticks_tabs"
    const { data: noteTabs } = await supabase
      .from("personal_sticks_tabs")
      .select("*")
      .eq("personal_stick_id", id)
      .eq("user_id", user.id)

    let tags: string[] = []
    let images: ImageItem[] = []
    let videos: VideoItem[] = []

    if (noteTabs) {
      for (const tab of noteTabs as any[]) {
        if (tab.tab_data) {
          const tabData = typeof tab.tab_data === "string" ? JSON.parse(tab.tab_data) : tab.tab_data
          if (tabData.tags && Array.isArray(tabData.tags)) {
            tags = [...tags, ...tabData.tags]
          }
          if (tabData.images && Array.isArray(tabData.images)) {
            images = [...images, ...tabData.images]
          }
          if (tabData.videos && Array.isArray(tabData.videos)) {
            videos = [...videos, ...tabData.videos]
          }
        }
      }
    }

    const transformedNote: Note = {
      id: typeof note.id === "string" && note.id ? note.id : "unknown-id",
      topic: note.topic || "",
      title: note.title || note.topic || "Untitled Note",
      content: note.content || "",
      color: note.color || "#fef3c7",
      position_x: note.position_x || 0,
      position_y: note.position_y || 0,
      is_shared: Boolean(note.is_shared),
      z_index: note.z_index || undefined,
      is_pinned: note.is_pinned || undefined,
      tags: tags,
      images: images,
      videos: videos,
      created_at: typeof note.created_at === "string" && note.created_at ? note.created_at : new Date().toISOString(),
      updated_at: typeof note.updated_at === "string" && note.updated_at ? note.updated_at : new Date().toISOString(),
      user_id: typeof note.user_id === "string" && note.user_id ? note.user_id : "unknown-user",
      replies: (replies || []).map((reply: unknown) => {
        const r = reply as any
        return {
          id: typeof r.id === "string" && r.id ? r.id : "unknown-reply-id",
          content: r.content || "",
          color: r.color || "#ffffff",
          created_at: typeof r.created_at === "string" && r.created_at ? r.created_at : new Date().toISOString(),
          updated_at:
            typeof r.updated_at === "string" && r.updated_at
              ? r.updated_at
              : typeof r.created_at === "string" && r.created_at
                ? r.created_at
                : new Date().toISOString(),
          user_id: typeof r.user_id === "string" && r.user_id ? r.user_id : "unknown-user",
          note_id:
            typeof r.personal_stick_id === "string" && r.personal_stick_id ? r.personal_stick_id : "unknown-note-id",
        }
      }),
    }

    return transformedNote
  } catch (error) {
    console.error("Error in updateNote:", error)
    throw error
  }
}

/**
 * Update personal stick (note) position
 */
export async function updateNotePosition(noteId: string, x: number, y: number): Promise<Note> {
  try {
    const supabase = createClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Authentication error:", authError)
      throw new Error("User not authenticated")
    }

    const { data: noteRaw, error } = await (supabase as any)
      .from("personal_sticks")
      .update({
        position_x: x,
        position_y: y,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .eq("user_id", user.id)
      .select(
        `
        id,
        title,
        topic,
        content,
        color,
        position_x,
        position_y,
        is_shared,
        z_index,
        is_pinned,
        created_at,
        updated_at,
        user_id
      `,
      )
      .single()

    const note = (noteRaw ?? {}) as Partial<Note>

    if (error) {
      console.error("Database error updating note position:", error)
      throw new Error(`Failed to update note position: ${error.message}`)
    }

    if (!note) {
      throw new Error("Note not found or you don't have permission to update it")
    }

    const { data: replies } = await supabase
      .from("personal_sticks_replies")
      .select(
        `
        id,
        content,
        color,
        created_at,
        updated_at,
        user_id,
        personal_stick_id
      `,
      )
      .eq("personal_stick_id", typeof note.id === "string" && note.id ? note.id : "")
      .order("created_at", { ascending: true })

    const repliesArray: any[] = replies || []

    // Changed from "note_tabs" to "personal_sticks_tabs"
    const { data: noteTabs } = await supabase
      .from("personal_sticks_tabs")
      .select("*")
      .eq("personal_stick_id", typeof note.id === "string" && note.id ? note.id : "")
      .eq("user_id", user.id)

    let tags: string[] = []
    let images: ImageItem[] = []
    let videos: VideoItem[] = []

    if (noteTabs) {
      for (const tab of noteTabs as any[]) {
        if (tab.tab_data) {
          const tabData = typeof tab.tab_data === "string" ? JSON.parse(tab.tab_data) : tab.tab_data
          if (tabData.tags && Array.isArray(tabData.tags)) {
            tags = [...tags, ...tabData.tags]
          }
          if (tabData.images && Array.isArray(tabData.images)) {
            images = [...images, ...tabData.images]
          }
          if (tabData.videos && Array.isArray(tabData.videos)) {
            videos = [...videos, ...tabData.videos]
          }
        }
      }
    }

    const transformedNote: Note = {
      id: typeof note.id === "string" && note.id ? note.id : "unknown-id",
      topic: note.topic || "",
      title: note.title || note.topic || "Untitled Note",
      content: note.content || "",
      color: note.color || "#fef3c7",
      position_x: note.position_x || 0,
      position_y: note.position_y || 0,
      is_shared: Boolean(note.is_shared),
      z_index: note.z_index || undefined,
      is_pinned: note.is_pinned || undefined,
      tags: tags,
      images: images,
      videos: videos,
      created_at: typeof note.created_at === "string" && note.created_at ? note.created_at : new Date().toISOString(),
      updated_at: typeof note.updated_at === "string" && note.updated_at ? note.updated_at : new Date().toISOString(),
      user_id: typeof note.user_id === "string" && note.user_id ? note.user_id : "unknown-user",
      replies: repliesArray.map((reply: unknown) => {
        const r = reply as any
        return {
          id: typeof r.id === "string" && r.id ? r.id : "unknown-reply-id",
          content: r.content || "",
          color: r.color || "#ffffff",
          created_at: typeof r.created_at === "string" && r.created_at ? r.created_at : new Date().toISOString(),
          updated_at:
            typeof r.updated_at === "string" && r.updated_at
              ? r.updated_at
              : typeof r.created_at === "string" && r.created_at
                ? r.created_at
                : new Date().toISOString(),
          user_id: typeof r.user_id === "string" && r.user_id ? r.user_id : "unknown-user",
          note_id:
            typeof r.personal_stick_id === "string" && r.personal_stick_id ? r.personal_stick_id : "unknown-note-id",
        }
      }),
    }

    return transformedNote
  } catch (error) {
    console.error("Error in updateNotePosition:", error)
    throw error
  }
}

/**
 * Delete a personal stick (note)
 */
export async function deleteNote(noteId: string): Promise<void> {
  try {
    const supabase = createClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Authentication error:", authError)
      throw new Error("User not authenticated")
    }

    const { error } = await supabase.from("personal_sticks").delete().eq("id", noteId).eq("user_id", user.id)

    if (error) {
      console.error("Database error deleting note:", error)
      throw new Error(`Failed to delete note: ${error.message}`)
    }
  } catch (error) {
    console.error("Error in deleteNote:", error)
    throw error
  }
}

/**
 * Create a reply on a personal stick (note)
 */
export async function createReply(replyData: CreateReplyData): Promise<Reply> {
  try {
    const supabase = createClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error("Authentication error:", authError)
      throw new Error("User not authenticated")
    }

    const replyToCreate: ReplyInsertPayload = {
      personal_stick_id: replyData.note_id, // Map note_id to personal_stick_id
      user_id: user.id,
      content: replyData.content || "",
      color: replyData.color || "#ffffff",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: replyRaw, error } = await (supabase as any)
      .from("personal_sticks_replies")
      .insert([replyToCreate])
      .select(
        `
        id,
        content,
        color,
        created_at,
        updated_at,
        user_id,
        personal_stick_id
      `,
      )
      .single()

    const reply = replyRaw as DatabaseReplyRow | null

    if (error) {
      console.error("Database error creating reply:", error)
      throw new Error(`Failed to create reply: ${error.message}`)
    }

    if (!reply) {
      throw new Error("Reply was not created")
    }

    return {
      id: reply.id,
      content: reply.content || "",
      color: reply.color || "#ffffff",
      created_at: reply.created_at,
      updated_at: reply.updated_at || reply.created_at,
      user_id: reply.user_id,
      note_id: reply.personal_stick_id,
    }
  } catch (error) {
    console.error("Error in createReply:", error)
    throw error
  }
}
