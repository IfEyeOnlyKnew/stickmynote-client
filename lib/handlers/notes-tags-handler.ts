// Notes Tags handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get a note with its tags using personal_sticks tables.
 */
export async function getNoteWithTags(
  noteId: string,
  userId: string
): Promise<{ status: number; body: any }> {
  // Get note
  const noteResult = await db.query(
    `SELECT * FROM personal_sticks WHERE id = $1 AND user_id = $2`,
    [noteId, userId]
  )

  if (noteResult.rows.length === 0) {
    return { status: 404, body: { error: 'Note not found' } }
  }

  // Get tags
  const tagsResult = await db.query(
    `SELECT id, tag_title, tag_order, created_at
     FROM personal_sticks_tags
     WHERE personal_stick_id = $1
     ORDER BY tag_order ASC`,
    [noteId]
  )

  return {
    status: 200,
    body: {
      note: noteResult.rows[0],
      tags: tagsResult.rows,
    },
  }
}

/**
 * Add a tag to a note.
 */
export async function addNoteTag(
  noteId: string,
  userId: string,
  tagTitle: string
): Promise<{ status: number; body: any }> {
  // Check note ownership
  const noteResult = await db.query(
    `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
    [noteId, userId]
  )

  if (noteResult.rows.length === 0) {
    return { status: 404, body: { error: 'Note not found' } }
  }

  // Get max order
  const orderResult = await db.query(
    `SELECT COALESCE(MAX(tag_order), 0) + 1 as next_order FROM personal_sticks_tags WHERE personal_stick_id = $1`,
    [noteId]
  )
  const nextOrder = orderResult.rows[0]?.next_order || 1

  // Insert tag
  const insertResult = await db.query(
    `INSERT INTO personal_sticks_tags (personal_stick_id, tag_title, tag_order)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [noteId, tagTitle.trim(), nextOrder]
  )

  return { status: 200, body: { tag: insertResult.rows[0] } }
}

/**
 * Remove a tag from a note by ID or title.
 */
export async function removeNoteTag(
  noteId: string,
  userId: string,
  options: { tagId?: string; tagTitle?: string }
): Promise<{ status: number; body: any }> {
  // Check note ownership
  const noteResult = await db.query(
    `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
    [noteId, userId]
  )

  if (noteResult.rows.length === 0) {
    return { status: 404, body: { error: 'Note not found' } }
  }

  if (options.tagId) {
    await db.query(
      `DELETE FROM personal_sticks_tags WHERE id = $1 AND personal_stick_id = $2`,
      [options.tagId, noteId]
    )
  } else if (options.tagTitle) {
    await db.query(
      `DELETE FROM personal_sticks_tags WHERE tag_title = $1 AND personal_stick_id = $2`,
      [options.tagTitle, noteId]
    )
  } else {
    return { status: 400, body: { error: 'Tag ID or title is required' } }
  }

  return { status: 200, body: { success: true } }
}
