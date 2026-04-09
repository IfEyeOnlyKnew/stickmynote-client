import { queryOne, queryMany, execute } from "@/lib/database/pg-client"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import type { Reply, NoteTab } from "@/types/note"
import {
  type Note,
  type CreateNoteData,
  type UpdateNoteData,
  type CreateReplyData,
  type NotesResponse,
  type DatabaseNoteRow,
  type DatabaseReplyRow,
  type ExtractedTabData,
  extractTabData,
  transformReplyFromRaw,
  transformPartialNote,
  buildNoteUpdatePayload,
} from "@/lib/notes-shared"

// Re-export shared types for backward compatibility
export type { Note, CreateNoteData, UpdateNoteData, CreateReplyData, NotesResponse } from "@/lib/notes-shared"

// Local aliases for internal use
const transformReply = transformReplyFromRaw
const buildTransformedNote = (noteData: any, tabData: ExtractedTabData, replies: unknown[]) =>
  transformPartialNote(noteData, tabData, (replies as any[]).map(transformReplyFromRaw))
const buildUpdatePayload = buildNoteUpdatePayload

// ============================================================================
// AUTH HELPER
// ============================================================================

async function getAuthenticatedUser() {
  const db = await createDatabaseClient()
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")
  return { db, user }
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
    const { user } = await getAuthenticatedUser()

    // Build query based on filter
    let whereClause = "user_id = $1"
    
    if (filter === "personal") {
      whereClause += " AND is_shared = false"
    } else if (filter === "shared") {
      whereClause += " AND is_shared = true"
    }

    const notes = await queryMany<DatabaseNoteRow>(
      `SELECT id, title, topic, content, color, position_x, position_y, 
              is_shared, z_index, is_pinned, created_at, updated_at, user_id
       FROM personal_sticks 
       WHERE ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    )

    const notesWithReplies: Note[] = []

    for (const note of (notes || [])) {
      const replies = await queryMany<DatabaseReplyRow>(
        `SELECT id, content, color, created_at, updated_at, user_id, personal_stick_id
         FROM personal_sticks_replies
         WHERE personal_stick_id = $1
         ORDER BY created_at ASC`,
        [note.id]
      )

      const typedReplies = replies || []

      // Fetch tabs from PostgreSQL
      const noteTabs = await queryMany(
        `SELECT * FROM personal_sticks_tabs
         WHERE personal_stick_id = $1 AND user_id = $2`,
        [note.id, user.id]
      )

      const { tags, images, videos } = extractTabData(noteTabs)

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
        tags,
        images,
        videos,
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
          parent_reply_id: reply.parent_reply_id || null,
        })),
      }

      notesWithReplies.push(transformedNote)
    }

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM personal_sticks WHERE user_id = $1`,
      [user.id]
    )
    const totalCount = countResult ? Number.parseInt(countResult.count) : 0

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
    const { user } = await getAuthenticatedUser()

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

    const note = await queryOne<DatabaseNoteRow>(
      `INSERT INTO personal_sticks 
       (user_id, title, topic, content, color, position_x, position_y, is_shared, z_index, is_pinned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, title, topic, content, color, position_x, position_y, 
                 is_shared, z_index, is_pinned, created_at, updated_at, user_id`,
      [
        noteToCreate.user_id,
        noteToCreate.title,
        noteToCreate.topic,
        noteToCreate.content,
        noteToCreate.color,
        noteToCreate.position_x,
        noteToCreate.position_y,
        noteToCreate.is_shared,
        noteToCreate.z_index,
        noteToCreate.is_pinned,
      ]
    )

    if (!note) {
      throw new Error("Note was not created")
    }

    if (noteData.tags || noteData.images || noteData.videos) {
      const tabData = {
        tags: noteData.tags || [],
        images: noteData.images || [],
        videos: noteData.videos || [],
      }

      await execute(
        `INSERT INTO personal_sticks_tabs 
         (personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [note.id, user.id, "main", "Main", "", JSON.stringify(tabData), 1]
      )
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
    const { user } = await getAuthenticatedUser()

    const { id, ...updateData } = noteData
    const updatePayload = buildUpdatePayload(updateData)

    // Build dynamic UPDATE query
    const fields = Object.keys(updatePayload).filter(k => k !== 'updated_at')
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
    const values = fields.map(f => (updatePayload as any)[f])
    values.push(id, user.id)

    const note = await queryOne<DatabaseNoteRow>(
      `UPDATE personal_sticks
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2}
       RETURNING id, title, topic, content, color, position_x, position_y,
                 is_shared, z_index, is_pinned, created_at, updated_at, user_id`,
      values
    )

    if (!note) {
      throw new Error("Note not found or you don't have permission to update it")
    }

    if (updateData.tags || updateData.images || updateData.videos) {
      const tabData = {
        tags: updateData.tags || [],
        images: updateData.images || [],
        videos: updateData.videos || [],
      }

      const existingTab = await queryOne<{ id: string }>(
        `SELECT id FROM personal_sticks_tabs
         WHERE personal_stick_id = $1 AND user_id = $2 AND tab_type = $3`,
        [id, user.id, "main"]
      )

      if (existingTab?.id) {
        await execute(
          `UPDATE personal_sticks_tabs
           SET tab_data = $1, updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(tabData), existingTab.id]
        )
      } else {
        await execute(
          `INSERT INTO personal_sticks_tabs
           (personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, user.id, "main", "Main", "", JSON.stringify(tabData), 1]
        )
      }
    }

    const replies = await queryMany(
      `SELECT id, content, color, created_at, updated_at, user_id, personal_stick_id
       FROM personal_sticks_replies
       WHERE personal_stick_id = $1
       ORDER BY created_at ASC`,
      [id]
    )

    const noteTabs = await queryMany(
      `SELECT * FROM personal_sticks_tabs
       WHERE personal_stick_id = $1 AND user_id = $2`,
      [id, user.id]
    )

    const tabData = extractTabData(noteTabs)
    const transformedNote = buildTransformedNote(note, tabData, replies)

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
    const { user } = await getAuthenticatedUser()

    const note = await queryOne<DatabaseNoteRow>(
      `UPDATE personal_sticks
       SET position_x = $1, position_y = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, title, topic, content, color, position_x, position_y,
                 is_shared, z_index, is_pinned, created_at, updated_at, user_id`,
      [x, y, noteId, user.id]
    )

    if (!note) {
      throw new Error("Note not found or you don't have permission to update it")
    }

    const repliesArray = await queryMany(
      `SELECT id, content, color, created_at, updated_at, user_id, personal_stick_id
       FROM personal_sticks_replies
       WHERE personal_stick_id = $1
       ORDER BY created_at ASC`,
      [noteId]
    )

    const noteTabs = await queryMany(
      `SELECT * FROM personal_sticks_tabs
       WHERE personal_stick_id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    const tabData = extractTabData(noteTabs)
    const transformedNote = buildTransformedNote(note, tabData, repliesArray)

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
    const { user } = await getAuthenticatedUser()

    await execute(
      `DELETE FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )
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
    const { user } = await getAuthenticatedUser()

    const reply = await queryOne<DatabaseReplyRow>(
      `INSERT INTO personal_sticks_replies
       (personal_stick_id, user_id, content, color)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, color, created_at, updated_at, user_id, personal_stick_id`,
      [
        replyData.note_id,
        user.id,
        replyData.content || "",
        replyData.color || "#ffffff",
      ]
    )

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

/**
 * Get all tabs for a note
 */
export async function getNoteTabs(noteId: string): Promise<NoteTab[]> {
  try {
    console.log("[v0] getNoteTabs called for noteId:", noteId)
    const response = await fetch(`/api/note-tabs?noteId=${noteId}`)
    console.log("[v0] getNoteTabs response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] getNoteTabs error response:", errorText)
      throw new Error(`Failed to fetch note tabs: ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] getNoteTabs data:", data)

    return (data.tabs || []).map((tab: any) => ({
      id: tab.id,
      note_id: tab.personal_stick_id || noteId,
      tab_type: tab.tab_type as "main" | "videos" | "images" | "details",
      tab_data: tab.tab_data || {},
      created_at: tab.created_at,
      updated_at: tab.updated_at,
    }))
  } catch (error) {
    console.error("[v0] Error fetching note tabs:", error)
    return []
  }
}

/**
 * Save a tab for a note
 */
export async function saveNoteTab(noteId: string, tabType: string, data: any): Promise<any> {
  try {
    console.log("[v0] saveNoteTab called:", { noteId, tabType, data })
    const response = await fetch(`/api/note-tabs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, tab_type: tabType, tab_data: data }),
    })

    console.log("[v0] saveNoteTab response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] saveNoteTab error response:", errorText)
      throw new Error(`Failed to save note tab: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("[v0] Error saving note tab:", error)
    throw error
  }
}

/**
 * Delete a tab item for a note
 */
export async function deleteNoteTabItem(noteId: string, tabType: string, itemId: string): Promise<void> {
  try {
    console.log("[v0] deleteNoteTabItem called:", { noteId, tabType, itemId })
    const response = await fetch(`/api/note-tabs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, tab_type: tabType, item_id: itemId }),
    })

    console.log("[v0] deleteNoteTabItem response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] deleteNoteTabItem error response:", errorText)
      throw new Error(`Failed to delete note tab item: ${response.status}`)
    }
  } catch (error) {
    console.error("[v0] Error deleting note tab item:", error)
    throw error
  }
}
