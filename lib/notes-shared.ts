import type { Note as BaseNote, Reply, VideoItem, ImageItem } from "@/types/note"

/**
 * Shared types and helpers for notes/note-tabs libraries.
 * Deduplicates code between lib/notes.ts (query builder) and lib/note-tabs.ts (raw SQL).
 */

// ============================================================================
// SHARED TYPES
// ============================================================================

/** Extended Note type with tags, images, videos, and replies */
export interface Note extends BaseNote {
  tags: string[]
  images: ImageItem[]
  videos: VideoItem[]
  replies: Reply[]
}

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

export interface DatabaseNoteRow {
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

export interface DatabaseReplyRow {
  id: string
  personal_stick_id: string
  user_id: string
  content: string
  color: string
  created_at: string
  updated_at: string
  parent_reply_id?: string | null
}

export interface ReplyInsertPayload {
  personal_stick_id: string
  content: string
  color: string
  created_at: string
  updated_at: string
  user_id: string
}

export interface NotesInsertPayload {
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

// ============================================================================
// SHARED HELPER FUNCTIONS
// ============================================================================

export interface ExtractedTabData {
  tags: string[]
  images: ImageItem[]
  videos: VideoItem[]
}

/**
 * Extracts tags, images, and videos from note tabs
 */
export function extractTabData(noteTabs: any[] | null): ExtractedTabData {
  const result: ExtractedTabData = { tags: [], images: [], videos: [] }
  if (!noteTabs) return result

  for (const tab of noteTabs) {
    if (!tab.tab_data) continue
    const tabData = typeof tab.tab_data === "string" ? JSON.parse(tab.tab_data) : tab.tab_data
    if (Array.isArray(tabData.tags)) result.tags.push(...tabData.tags)
    if (Array.isArray(tabData.images)) result.images.push(...tabData.images)
    if (Array.isArray(tabData.videos)) result.videos.push(...tabData.videos)
  }
  return result
}

/**
 * Transforms a database reply row to a Reply object
 */
export function transformReplyRow(reply: DatabaseReplyRow): Reply {
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
 * Transforms raw reply data with safe type handling
 */
export function transformReplyFromRaw(r: any): Reply {
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
 * Transforms a database note row to a Note object
 */
export function transformDatabaseNote(
  note: DatabaseNoteRow,
  tabData: ExtractedTabData,
  replies: Reply[],
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
 * Transforms partial/raw note data with safe type handling
 */
export function transformPartialNote(
  note: Partial<Note>,
  tabData: ExtractedTabData,
  replies: Reply[],
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
 * Build update payload for note updates
 */
export function buildNoteUpdatePayload(updateData: Partial<CreateNoteData>): Record<string, unknown> {
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

/**
 * Build a NotesInsertPayload from create data and user ID
 */
export function buildNoteInsertPayload(userId: string, noteData: CreateNoteData): NotesInsertPayload {
  return {
    user_id: userId,
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
}

/**
 * Get authenticated user from database client
 */
export async function getAuthenticatedUser(db: any): Promise<{ id: string; email?: string }> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) {
    throw new Error("User not authenticated")
  }
  return user
}
