import { createDatabaseClient } from "@/lib/database/database-adapter"
import {
  type Note,
  type CreateNoteData,
  type UpdateNoteData,
  type CreateReplyData,
  type NotesResponse,
  type DatabaseNoteRow,
  type DatabaseReplyRow,
  type ReplyInsertPayload,
  type ExtractedTabData,
  extractTabData,
  transformReplyRow,
  transformReplyFromRaw,
  transformDatabaseNote,
  transformPartialNote,
  buildNoteUpdatePayload,
  getAuthenticatedUser,
} from "@/lib/notes-shared"
import type { Reply } from "@/types/note"

// Re-export shared types for backward compatibility
export type { Note, CreateNoteData, UpdateNoteData, CreateReplyData, NotesResponse } from "@/lib/notes-shared"

/**
 * Upsert note tab data (tags, images, videos) via query builder
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

// Alias for backward compatibility with internal callers
const extractDataFromTabs = extractTabData
const transformReply = transformReplyRow

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
