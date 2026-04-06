// Notes handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireId, requireOptionalString } from '@/lib/api/validate'
import { checkDLPPolicy } from '@/lib/dlp/policy-checker'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'

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

    // Fetch notes
    const notes = await query(
      'SELECT * FROM personal_sticks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [session.user.id, effectiveLimit, effectiveOffset]
    )

    // Get total count for pagination
    const countResult = await query(
      'SELECT COUNT(*) as count FROM personal_sticks WHERE user_id = $1',
      [session.user.id]
    )
    const total = Number.parseInt(countResult[0]?.count || '0', 10)

    // Get note IDs for fetching related data
    const noteIds = notes.map((n: { id: string }) => n.id)
    console.log('[notes-handler] Note IDs being queried:', noteIds)

    // Fetch tabs (which contain hyperlinks) for all notes
    let tabs: any[] = []
    if (noteIds.length > 0) {
      tabs = await query(
        `SELECT personal_stick_id, tab_name, tab_type, tags
         FROM personal_sticks_tabs
         WHERE personal_stick_id = ANY($1)`,
        [noteIds]
      )
      console.log('[notes-handler] Tabs fetched:', tabs.length)
      if (tabs.length > 0) {
        console.log('[notes-handler] First tab:', JSON.stringify(tabs[0]))
      }
    } else {
      console.log('[notes-handler] No note IDs to query tabs for')
    }

    // Fetch replies for all notes (include parent_reply_id for threading)
    let replies: any[] = []
    if (noteIds.length > 0) {
      replies = await query(
        `SELECT id, content, color, created_at, updated_at, user_id, personal_stick_id, parent_reply_id
         FROM personal_sticks_replies
         WHERE personal_stick_id = ANY($1)
         ORDER BY created_at ASC`,
        [noteIds]
      )
    }

    return { status: 200, body: { notes, total, tabs, replies } }
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
    // Record deletion for delta sync (so offline clients can catch up)
    try {
      await query(
        'INSERT INTO note_deletions (note_id, user_id) VALUES ($1, $2)',
        [validatedId, session.user.id]
      )
    } catch {
      // Table may not exist yet — non-critical, skip gracefully
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

// ============================================================================
// Shared helpers for v1/v2 notes/[id] routes
// ============================================================================

function extractDetails(tab: any): string | null {
  if (tab.tab_type === 'details' && tab.tab_data?.content) return tab.tab_data.content
  return null
}

function extractVideos(tab: any): any[] | null {
  if (tab.tab_type !== 'videos' && tab.tab_type !== 'video') return null
  if (!tab.tab_data) return null
  return Array.isArray(tab.tab_data) ? tab.tab_data : tab.tab_data.videos || []
}

function extractImages(tab: any): any[] | null {
  if (tab.tab_type !== 'images' || !tab.tab_data) return null
  return Array.isArray(tab.tab_data) ? tab.tab_data : tab.tab_data.images || []
}

function extractHyperlinks(tab: any): any[] | null {
  if (tab.tab_name !== 'Tags' || !tab.tags) return null
  return parseHyperlinks(tab.tags)
}

export function extractTabData(tabs: any[]) {
  const empty = { details: '', videos: [] as any[], images: [] as any[], hyperlinks: [] as any[] }
  if (!tabs || !Array.isArray(tabs)) return empty

  let details = ''
  let videos: any[] = []
  let images: any[] = []
  let hyperlinks: any[] = []

  for (const tab of tabs) {
    details = extractDetails(tab) ?? details
    videos = extractVideos(tab) ?? videos
    images = extractImages(tab) ?? images
    hyperlinks = extractHyperlinks(tab) ?? hyperlinks
  }

  return { details, videos, images, hyperlinks }
}

export function parseHyperlinks(tags: any): any[] {
  try {
    if (Array.isArray(tags)) return tags
    if (typeof tags === 'string') return JSON.parse(tags || '[]')
    return []
  } catch {
    return []
  }
}

/**
 * Fetch a single note with tabs and tags, returning the enriched note object.
 * Returns null if note not found for the given user.
 */
export async function getNoteWithDetails(noteId: string, userId: string) {
  const note = await querySingle(
    `SELECT * FROM personal_sticks WHERE id = $1 AND user_id = $2`,
    [noteId, userId]
  )

  if (!note) return null

  const tabs = await query(
    `SELECT tab_type, tab_data, tab_name, tags FROM personal_sticks_tabs WHERE personal_stick_id = $1`,
    [noteId]
  )
  const { details, videos, images, hyperlinks } = extractTabData(tabs)

  const tagRows = await query(
    `SELECT tag_title FROM personal_sticks_tags WHERE personal_stick_id = $1 ORDER BY tag_order ASC`,
    [noteId]
  )
  const tags = tagRows.map((t: { tag_title: string }) => t.tag_title)

  return { ...note, details, tags, images, videos, hyperlinks }
}

/**
 * Check DLP policy when sharing a note. Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function checkNoteDLP(noteId: string, userId: string, body: any): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  if (body.is_shared !== true) return { allowed: true }

  const noteForDLP = await querySingle(
    `SELECT org_id, topic, content, sensitivity_level FROM personal_sticks WHERE id = $1 AND user_id = $2`,
    [noteId, userId]
  )
  if (!noteForDLP) return { allowed: true }

  const dlpResult = await checkDLPPolicy({
    orgId: noteForDLP.org_id,
    action: 'share_note',
    userId,
    content: `${noteForDLP.topic || ''} ${noteForDLP.content || ''} ${body.topic || ''} ${body.content || ''}`,
    sensitivityLevel: noteForDLP.sensitivity_level,
  })

  if (!dlpResult.allowed) {
    return { allowed: false, reason: dlpResult.reason || 'DLP policy violation' }
  }
  return { allowed: true }
}

/**
 * Update note fields (shared between PUT and PATCH).
 * Returns the updated row or null if not found.
 */
export async function updateNoteFields(noteId: string, userId: string, body: any) {
  const result = await querySingle(
    `UPDATE personal_sticks SET
      title = COALESCE($1, title),
      topic = COALESCE($2, topic),
      content = COALESCE($3, content),
      color = COALESCE($4, color),
      position_x = COALESCE($5, position_x),
      position_y = COALESCE($6, position_y),
      is_shared = COALESCE($7, is_shared),
      updated_at = NOW()
     WHERE id = $8 AND user_id = $9
     RETURNING *`,
    [
      body.title ?? null,
      body.topic ?? null,
      body.content ?? null,
      body.color ?? null,
      body.position_x ?? null,
      body.position_y ?? null,
      body.is_shared ?? null,
      noteId,
      userId,
    ]
  )
  return result
}

/**
 * Delete a note after checking legal hold.
 * Returns { status, body } with appropriate response.
 */
export async function deleteNoteById(noteId: string, userId: string): Promise<{ status: number; body: any; deletedId?: string }> {
  if (await isUnderLegalHold(userId)) {
    return { status: 403, body: { error: 'Content cannot be deleted: active legal hold' } }
  }

  const deleted = await querySingle(
    `DELETE FROM personal_sticks WHERE id = $1 AND user_id = $2 RETURNING id`,
    [noteId, userId]
  )

  if (!deleted) {
    return { status: 404, body: { error: 'Note not found' } }
  }

  // Record deletion for delta sync
  try {
    await query(
      `INSERT INTO note_deletions (note_id, user_id) VALUES ($1, $2)`,
      [deleted.id, userId]
    )
  } catch {
    // Table may not exist yet - non-critical
  }

  return { status: 200, body: { message: 'Note deleted successfully' }, deletedId: deleted.id }
}
