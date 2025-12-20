// Notes handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireId, requireOptionalString } from '@/lib/api/validate'

export interface NotesSession {
  user: { id: string; org_id?: string }
}

export interface CreateNoteInput {
  title?: string | null
  content?: string | null
  color?: string | null
  topic?: string | null
}

export interface UpdateNoteInput {
  title?: string | null
  content?: string | null
  color?: string | null
  topic?: string | null
  is_shared?: boolean | null
  position_x?: number | null
  position_y?: number | null
  z_index?: number | null
}

// List notes for user (personal_sticks table)
export async function listNotes(session: NotesSession, limit = 50, offset = 0) {
  try {
    const effectiveLimit = Math.min(limit, 100)
    const effectiveOffset = Math.max(offset, 0)
    const notes = await query(
      'SELECT * FROM personal_sticks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [session.user.id, effectiveLimit, effectiveOffset]
    )
    return { status: 200, body: { notes } }
  } catch (error) {
    console.error('[notes-handler] listNotes error:', error)
    return { status: 500, body: { error: 'Failed to list notes' } }
  }
}

// Create a note
export async function createNote(session: NotesSession, input: CreateNoteInput) {
  try {
    const title = input.title || ''
    const content = input.content || ''
    const color = requireOptionalString(input.color) || '#FFFFA5'
    const topic = requireOptionalString(input.topic) || ''
    const now = new Date().toISOString()
    const note = await querySingle(
      `INSERT INTO personal_sticks (user_id, title, topic, content, color, is_shared, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, false, $6, $6) RETURNING *`,
      [session.user.id, title, topic, content, color, now]
    )
    return { status: 201, body: { note } }
  } catch (error: any) {
    console.error('[notes-handler] createNote error:', error)
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create note' } }
  }
}

// Update a note
export async function updateNote(session: NotesSession, noteId: string, input: UpdateNoteInput) {
  try {
    const validatedId = requireId(noteId, 'id')
    const title = requireOptionalString(input.title)
    const content = requireOptionalString(input.content)
    const color = requireOptionalString(input.color)
    const topic = requireOptionalString(input.topic)
    const now = new Date().toISOString()
    const note = await querySingle(
      `UPDATE personal_sticks SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        color = COALESCE($3, color),
        topic = COALESCE($4, topic),
        updated_at = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [title, content, color, topic, now, validatedId, session.user.id]
    )
    if (!note) {
      return { status: 404, body: { error: 'Note not found or not owned by user' } }
    }
    return { status: 200, body: { note } }
  } catch (error: any) {
    console.error('[notes-handler] updateNote error:', error)
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to update note' } }
  }
}

// Delete a note
export async function deleteNote(session: NotesSession, noteId: string) {
  try {
    const validatedId = requireId(noteId, 'id')
    const deleted = await querySingle(
      'DELETE FROM personal_sticks WHERE id = $1 AND user_id = $2 RETURNING id',
      [validatedId, session.user.id]
    )
    if (!deleted) {
      return { status: 404, body: { error: 'Note not found or not owned by user' } }
    }
    return { status: 200, body: { success: true } }
  } catch (error: any) {
    console.error('[notes-handler] deleteNote error:', error)
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to delete note' } }
  }
}
