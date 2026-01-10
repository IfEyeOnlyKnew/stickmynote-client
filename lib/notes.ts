import { createDatabaseClient } from "@/lib/database/database-adapter"
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
  parent_reply_id?: string | null
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
// HELPER FUNCTIONS
// ============================================================================

interface TabDataContent {
  tags?: string[]
  images?: ImageItem[]
  videos?: VideoItem[]
}

interface ExtractedTabData {
  tags: string[]
  images: ImageItem[]
  videos: VideoItem[]
}

/**
 * Extract tags, images, and videos from note tabs
 */
function extractDataFromTabs(noteTabs: any[] | null): ExtractedTabData {
  const result: ExtractedTabData = { tags: [], images: [], videos: [] }
  if (!noteTabs) return result

  for (const tab of noteTabs) {
    if (!tab.tab_data) continue
    const tabData: TabDataContent = typeof tab.tab_data === "string" ? JSON.parse(tab.tab_data) : tab.tab_data
    if (Array.isArray(tabData.tags)) result.tags.push(...tabData.tags)
    if (Array.isArray(tabData.images)) result.images.push(...tabData.images)
    if (Array.isArray(tabData.videos)) result.videos.push(...tabData.videos)
  }
  return result
}

/**
 * Transform a database reply row to a Reply object
 */
function transformReply(reply: DatabaseReplyRow): Reply {
  return {
    id: reply.id,
    content: reply.content || "",
    color: reply.color || "#ffffff",
    created_at: reply.created_at,
    updated_at: reply.updated_at || reply.created_at,
    user_id: reply.user_id,
    note_id: reply.personal_stick_id,
    parent_reply_id: reply.parent_reply_id || null,
  }
}

/**
 * Transform raw reply data with safe type handling
 */
function transformReplyFromRaw(r: any): Reply {
  const now = new Date().toISOString()
  const createdAt = typeof r.created_at === "string" && r.created_at ? r.created_at : now
  const updatedAt = typeof r.updated_at === "string" && r.updated_at ? r.updated_at : createdAt

  return {
    id: typeof r.id === "string" && r.id ? r.id : "unknown-reply-id",
    content: r.content || "",
    color: r.color || "#ffffff",
    created_at: createdAt,
    updated_at: updatedAt,
    user_id: typeof r.user_id === "string" && r.user_id ? r.user_id : "unknown-user",
    note_id: typeof r.personal_stick_id === "string" && r.personal_stick_id ? r.personal_stick_id : "unknown-note-id",
    parent_reply_id: r.parent_reply_id || null,
  }
}

/**
 * Transform a database note row to a Note object
 */
function transformDatabaseNote(
  note: DatabaseNoteRow,
  tabData: ExtractedTabData,
  replies: Reply[]
): Note {
  return {
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
    tags: tabData.tags,
    images: tabData.images,
    videos: tabData.videos,
    created_at: note.created_at,
    updated_at: note.updated_at,
    user_id: note.user_id,
    replies,
  }
}

/**
 * Transform a partial note with safe type handling
 */
function transformPartialNote(
  note: Partial<Note>,
  tabData: ExtractedTabData,
  replies: Reply[]
): Note {
  const now = new Date().toISOString()
  return {
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
    tags: tabData.tags,
    images: tabData.images,
    videos: tabData.videos,
    created_at: typeof note.created_at === "string" && note.created_at ? note.created_at : now,
    updated_at: typeof note.updated_at === "string" && note.updated_at ? note.updated_at : now,
    user_id: typeof note.user_id === "string" && note.user_id ? note.user_id : "unknown-user",
    replies,
  }
}

/**
 * Get authenticated user from database client
 */
async function getAuthenticatedUser(db: any): Promise<{ id: string; email?: string }> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) {
    throw new Error("User not authenticated")
  }
  return user
}

/**
 * Upsert note tab data (tags, images, videos)
 */
async function upsertNoteTabData(
  db: any,
  noteId: string,
  userId: string,
  updateData: { tags?: string[]; images?: string[]; videos?: string[] }
): Promise<void> {
  if (!updateData.tags && !updateData.images && !updateData.videos) {
    return
  }

  const tabData = {
    tags: updateData.tags || [],
    images: updateData.images || [],
    videos: updateData.videos || [],
  }

  const { data: existingTab } = await db
    .from("personal_sticks_tabs")
    .select("id")
    .eq("personal_stick_id", noteId)
    .eq("user_id", userId)
    .eq("tab_type", "main")
    .single()

  if (existingTab?.id) {
    await db
      .from("personal_sticks_tabs")
      .update({ tab_data: tabData, updated_at: new Date().toISOString() })
      .eq("id", existingTab.id)
  } else {
    await db.from("personal_sticks_tabs").insert([{
      personal_stick_id: noteId,
      user_id: userId,
      tab_type: "main",
      tab_name: "Main",
      tab_content: "",
      tab_data: tabData,
      tab_order: 1,
    }])
  }
}

/**
 * Build update payload for note updates
 */
function buildNoteUpdatePayload(updateData: Partial<CreateNoteData>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updateData.topic !== undefined) {
    payload.topic = updateData.topic
    payload.title = updateData.topic || "Untitled Note"
  }
  if (updateData.content !== undefined) payload.content = updateData.content
  if (updateData.color !== undefined) payload.color = updateData.color
  if (updateData.position_x !== undefined) payload.position_x = updateData.position_x
  if (updateData.position_y !== undefined) payload.position_y = updateData.position_y
  if (updateData.is_shared !== undefined) payload.is_shared = Boolean(updateData.is_shared)

  return payload
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
    const db = await createDatabaseClient()
    if (!db) {
      throw new Error("Database client not initialized")
    }

    const user = await getAuthenticatedUser(db)

    let notesQuery = db
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
      throw new Error(`Failed to fetch notes: ${notesError.message}`)
    }

    const notesWithReplies = await Promise.all(
      ((notes || []) as DatabaseNoteRow[]).map(async (note) => {
        const { data: replies, error: repliesError } = await db
          .from("personal_sticks_replies")
          .select(`id, content, color, created_at, updated_at, user_id, personal_stick_id, parent_reply_id`)
          .eq("personal_stick_id", note.id)
          .order("created_at", { ascending: true })

        if (repliesError) {
          console.error("Error fetching replies for note:", note.id, repliesError)
        }

        const { data: noteTabs } = await db
          .from("personal_sticks_tabs")
          .select("*")
          .eq("personal_stick_id", note.id)
          .eq("user_id", user.id)

        const tabData = extractDataFromTabs(noteTabs as any[] | null)
        const typedReplies = ((replies || []) as DatabaseReplyRow[]).map(transformReply)

        return transformDatabaseNote(note, tabData, typedReplies)
      })
    )

    const { count: totalCount } = await db
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
    const db = await createDatabaseClient()
    const user = await getAuthenticatedUser(db)

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

    const { data: noteRaw, error } = await (db as any)
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
      throw new Error(`Failed to create note: ${error.message}`)
    }

    if (!note) {
      throw new Error("Note was not created")
    }

    if (noteData.tags || noteData.images || noteData.videos) {
      const tabDataPayload = {
        tags: noteData.tags || [],
        images: noteData.images || [],
        videos: noteData.videos || [],
      }

      await (db as any).from("personal_sticks_tabs").insert([
        {
          personal_stick_id: note.id,
          user_id: user.id,
          tab_type: "main",
          tab_name: "Main",
          tab_content: "",
          tab_data: tabDataPayload,
          tab_order: 1,
        },
      ])
    }

    const tabData: ExtractedTabData = {
      tags: noteData.tags || [],
      images: [],
      videos: [],
    }

    return transformDatabaseNote(note, tabData, [])
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
    const db = await createDatabaseClient()
    if (!db) {
      throw new Error("Database client not initialized")
    }

    const user = await getAuthenticatedUser(db)
    const { id, ...updateData } = noteData
    const updatePayload = buildNoteUpdatePayload(updateData)

    const { data: noteRaw, error } = await (db as any)
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
      throw new Error(`Failed to update note: ${error.message}`)
    }

    if (!note) {
      throw new Error("Note not found or you don't have permission to update it")
    }

    await upsertNoteTabData(db, id, user.id, updateData)

    const { data: repliesData } = await db
      .from("personal_sticks_replies")
      .select(`id, content, color, created_at, updated_at, user_id, personal_stick_id, parent_reply_id`)
      .eq("personal_stick_id", typeof note.id === "string" && note.id ? note.id : "")
      .order("created_at", { ascending: true })

    const { data: noteTabs } = await db
      .from("personal_sticks_tabs")
      .select("*")
      .eq("personal_stick_id", id)
      .eq("user_id", user.id)

    const tabData = extractDataFromTabs(noteTabs as any[] | null)
    const typedReplies = ((repliesData || []) as any[]).map(transformReplyFromRaw)

    return transformPartialNote(note, tabData, typedReplies)
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
    const db = await createDatabaseClient()
    if (!db) {
      throw new Error("Database client not initialized")
    }

    const user = await getAuthenticatedUser(db)

    const { data: noteRaw, error } = await (db as any)
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
      throw new Error(`Failed to update note position: ${error.message}`)
    }

    if (!note) {
      throw new Error("Note not found or you don't have permission to update it")
    }

    const noteIdStr = typeof note.id === "string" && note.id ? note.id : ""

    const { data: replies } = await db
      .from("personal_sticks_replies")
      .select(`id, content, color, created_at, updated_at, user_id, personal_stick_id, parent_reply_id`)
      .eq("personal_stick_id", noteIdStr)
      .order("created_at", { ascending: true })

    const { data: noteTabs } = await db
      .from("personal_sticks_tabs")
      .select("*")
      .eq("personal_stick_id", noteIdStr)
      .eq("user_id", user.id)

    const tabData = extractDataFromTabs(noteTabs as any[] | null)
    const typedReplies = ((replies || []) as any[]).map(transformReplyFromRaw)

    return transformPartialNote(note, tabData, typedReplies)
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
    const db = await createDatabaseClient()
    if (!db) {
      throw new Error("Database client not initialized")
    }

    const user = await getAuthenticatedUser(db)

    const { error } = await db.from("personal_sticks").delete().eq("id", noteId).eq("user_id", user.id)

    if (error) {
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
    const db = await createDatabaseClient()
    if (!db) {
      throw new Error("Database client not initialized")
    }

    const user = await getAuthenticatedUser(db)

    const replyToCreate: ReplyInsertPayload = {
      personal_stick_id: replyData.note_id,
      user_id: user.id,
      content: replyData.content || "",
      color: replyData.color || "#ffffff",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: replyRaw, error } = await (db as any)
      .from("personal_sticks_replies")
      .insert([replyToCreate])
      .select(`id, content, color, created_at, updated_at, user_id, personal_stick_id, parent_reply_id`)
      .single()

    const reply = replyRaw as DatabaseReplyRow | null

    if (error) {
      throw new Error(`Failed to create reply: ${error.message}`)
    }

    if (!reply) {
      throw new Error("Reply was not created")
    }

    return transformReply(reply)
  } catch (error) {
    console.error("Error in createReply:", error)
    throw error
  }
}
