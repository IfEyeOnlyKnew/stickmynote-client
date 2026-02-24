import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { createSafeAction, success, error } from "@/lib/safe-action"
import { createNoteSchema, updateNoteSchema } from "@/types/schemas"
import { APICache } from "@/lib/api-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { checkDLPPolicy } from "@/lib/dlp/policy-checker"

// ============================================================================
// Types
// ============================================================================

interface OrgContext {
  orgId: string
  organizationId?: string
}

interface NoteRecord {
  id: string
  title: string
  topic: string
  content: string
  color: string
  position_x: number
  position_y: number
  is_shared: boolean
  z_index: number
  is_pinned: boolean
  created_at: string
  updated_at: string
  user_id: string
  org_id: string
}

interface TabRecord {
  personal_stick_id: string
  tab_type: string
  tab_data: {
    tags?: string[]
    images?: ImageData[]
    videos?: VideoData[]
  }
}

interface ReplyRecord {
  id: string
  content: string
  color: string
  created_at: string
  user_id: string
  personal_stick_id: string
  parent_reply_id?: string | null
}

interface ImageData {
  url: string
  alt?: string
}

interface VideoData {
  url: string
  title?: string
}

interface TransformedNote {
  id: string
  title: string
  topic: string
  content: string
  color: string
  position_x: number
  position_y: number
  is_shared: boolean
  z_index: number
  is_pinned: boolean
  tags: string[]
  images: ImageData[]
  videos: VideoData[]
  created_at: string
  updated_at: string
  user_id: string
  org_id: string
  replies: TransformedReply[]
}

interface TransformedReply {
  id: string
  content: string
  color: string
  created_at: string
  updated_at: string
  user_id: string
  note_id: string
  parent_reply_id: string | null
}

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[Notes]"
const DEFAULT_COLOR = "#fef3c7"
const DEFAULT_REPLY_COLOR = "#ffffff"
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const CACHE_TTL = 30
const CACHE_STALE_WHILE_REVALIDATE = 60

const NOTE_SELECT_FIELDS = `
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
  user_id,
  org_id
`

const REPLY_SELECT_FIELDS = `
  id,
  content,
  color,
  created_at,
  user_id,
  personal_stick_id,
  parent_reply_id
`

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  noteIdRequired: () => NextResponse.json({ error: "Note ID is required" }, { status: 400 }),
  fetchFailed: () => NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 }),
  deleteFailed: () => NextResponse.json({ error: "Failed to delete note" }, { status: 500 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

// ============================================================================
// Helpers
// ============================================================================

function parseQueryParams(request: NextRequest): { limit: number; offset: number; filter: string } {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)), MAX_LIMIT)
  const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0"), 0)
  const filter = searchParams.get("filter") || "all"
  return { limit, offset, filter }
}

function transformReply(reply: ReplyRecord): TransformedReply {
  return {
    id: reply.id,
    content: reply.content || "",
    color: reply.color || DEFAULT_REPLY_COLOR,
    created_at: reply.created_at,
    updated_at: reply.created_at,
    user_id: reply.user_id,
    note_id: reply.personal_stick_id,
    parent_reply_id: reply.parent_reply_id || null,
  }
}

function transformNote(
  note: NoteRecord,
  tabs: TabRecord[],
  replies: ReplyRecord[]
): TransformedNote {
  let tags: string[] = []
  let images: ImageData[] = []
  let videos: VideoData[] = []

  for (const tab of tabs) {
    if (tab.tab_data) {
      if (tab.tab_data.tags) tags = [...tags, ...tab.tab_data.tags]
      if (tab.tab_data.images) images = [...images, ...tab.tab_data.images]
      if (tab.tab_data.videos) videos = [...videos, ...tab.tab_data.videos]
    }
  }

  return {
    id: note.id,
    title: note.title || note.topic || "",
    topic: note.topic || "",
    content: note.content || "",
    color: note.color || DEFAULT_COLOR,
    position_x: note.position_x || 0,
    position_y: note.position_y || 0,
    is_shared: Boolean(note.is_shared),
    z_index: note.z_index || 0,
    is_pinned: Boolean(note.is_pinned),
    tags,
    images,
    videos,
    created_at: note.created_at,
    updated_at: note.updated_at,
    user_id: note.user_id,
    org_id: note.org_id,
    replies: replies.map(transformReply),
  }
}

function createNotePayload(
  input: { topic?: string; content?: string; color?: string; position_x?: number; position_y?: number; is_shared?: boolean; z_index?: number; is_pinned?: boolean },
  userId: string,
  orgId: string
): Record<string, unknown> {
  return {
    user_id: userId,
    org_id: orgId,
    title: input.topic || "",
    topic: input.topic || "",
    content: input.content || "",
    color: input.color || DEFAULT_COLOR,
    position_x: input.position_x || 0,
    position_y: input.position_y || 0,
    is_shared: Boolean(input.is_shared),
    z_index: input.z_index || 0,
    is_pinned: Boolean(input.is_pinned),
  }
}

function buildUpdatePayload(updateData: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updateData.topic !== undefined) {
    payload.topic = updateData.topic
    payload.title = updateData.topic
  }
  if (updateData.content !== undefined) payload.content = updateData.content
  if (updateData.color !== undefined) payload.color = updateData.color
  if (updateData.position_x !== undefined) payload.position_x = updateData.position_x
  if (updateData.position_y !== undefined) payload.position_y = updateData.position_y
  if (updateData.is_shared !== undefined) payload.is_shared = Boolean(updateData.is_shared)
  if (updateData.z_index !== undefined) payload.z_index = updateData.z_index
  if (updateData.is_pinned !== undefined) payload.is_pinned = Boolean(updateData.is_pinned)

  return payload
}

// ============================================================================
// Database Operations
// ============================================================================

async function fetchNotesWithFilter(
  db: DatabaseClient,
  userId: string,
  orgId: string,
  filter: string,
  offset: number,
  limit: number
): Promise<{ data: NoteRecord[] | null; error: Error | null }> {
  let query = db
    .from("personal_sticks")
    .select(NOTE_SELECT_FIELDS)
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })

  if (filter === "personal") {
    query = query.eq("is_shared", false)
  } else if (filter === "shared") {
    query = query.eq("is_shared", true)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query
  return { data: data as NoteRecord[] | null, error }
}

async function fetchNoteTabs(
  db: DatabaseClient,
  noteIds: string[],
  orgId: string
): Promise<TabRecord[]> {
  if (noteIds.length === 0) return []

  const { data, error } = await db
    .from("personal_sticks_tabs")
    .select("personal_stick_id, tab_type, tab_data")
    .in("personal_stick_id", noteIds)
    .eq("org_id", orgId)

  if (error) {
    console.error(`${LOG_PREFIX} Error fetching note tabs:`, error)
    return []
  }

  return (data || []) as TabRecord[]
}

async function fetchNoteReplies(
  db: DatabaseClient,
  noteIds: string[],
  orgId: string
): Promise<ReplyRecord[]> {
  if (noteIds.length === 0) return []

  const { data, error } = await db
    .from("personal_sticks_replies")
    .select(REPLY_SELECT_FIELDS)
    .in("personal_stick_id", noteIds)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error(`${LOG_PREFIX} Error batch fetching replies:`, error)
    return []
  }

  return (data || []) as ReplyRecord[]
}

async function fetchTotalCount(
  db: DatabaseClient,
  userId: string,
  orgId: string
): Promise<number> {
  const { count } = await db
    .from("personal_sticks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("org_id", orgId)

  return count || 0
}

function groupByNoteId<T extends { personal_stick_id: string }>(
  items: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const arr = map.get(item.personal_stick_id) || []
    arr.push(item)
    map.set(item.personal_stick_id, arr)
  }
  return map
}

async function createNoteTabs(
  db: DatabaseClient,
  noteId: string,
  userId: string,
  orgId: string,
  input: { tags?: string[]; images?: ImageData[]; videos?: VideoData[] }
): Promise<void> {
  const tabsToCreate: Record<string, unknown>[] = []

  if (input.tags && input.tags.length > 0) {
    tabsToCreate.push({
      personal_stick_id: noteId,
      user_id: userId,
      org_id: orgId,
      tab_type: "details",
      tab_name: "Tags",
      tab_data: { tags: input.tags },
    })
  }

  if (input.images && input.images.length > 0) {
    tabsToCreate.push({
      personal_stick_id: noteId,
      user_id: userId,
      org_id: orgId,
      tab_type: "images",
      tab_name: "Images",
      tab_data: { images: input.images },
    })
  }

  if (input.videos && input.videos.length > 0) {
    tabsToCreate.push({
      personal_stick_id: noteId,
      user_id: userId,
      org_id: orgId,
      tab_type: "videos",
      tab_name: "Videos",
      tab_data: { videos: input.videos },
    })
  }

  if (tabsToCreate.length > 0) {
    const { error } = await db.from("personal_sticks_tabs").insert(tabsToCreate)
    if (error) {
      console.error(`${LOG_PREFIX} Error creating note tabs:`, error)
    }
  }
}

async function upsertNoteTabs(
  db: DatabaseClient,
  noteId: string,
  userId: string,
  orgId: string,
  updateData: { tags?: string[]; images?: ImageData[]; videos?: VideoData[] }
): Promise<void> {
  const tabUpdates: Record<string, unknown>[] = []

  if (updateData.tags !== undefined) {
    tabUpdates.push({
      personal_stick_id: noteId,
      user_id: userId,
      org_id: orgId,
      tab_type: "details",
      tab_name: "Tags",
      tab_data: { tags: updateData.tags },
    })
  }

  if (updateData.images !== undefined) {
    tabUpdates.push({
      personal_stick_id: noteId,
      user_id: userId,
      org_id: orgId,
      tab_type: "images",
      tab_name: "Images",
      tab_data: { images: updateData.images },
    })
  }

  if (updateData.videos !== undefined) {
    tabUpdates.push({
      personal_stick_id: noteId,
      user_id: userId,
      org_id: orgId,
      tab_type: "videos",
      tab_name: "Videos",
      tab_data: { videos: updateData.videos },
    })
  }

  for (const tabUpdate of tabUpdates) {
    await db.from("personal_sticks_tabs").upsert(tabUpdate, {
      onConflict: "personal_stick_id,tab_type",
      ignoreDuplicates: false,
    })
  }
}

// ============================================================================
// Runtime Config
// ============================================================================

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ============================================================================
// GET - Fetch personal sticks (notes)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const db = await createDatabaseClient()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return Errors.noOrgContext()
    }

    const { limit, offset, filter } = parseQueryParams(request)

    // Check cache
    const cacheKey = APICache.getCacheKey("notes", {
      userId: user.id,
      orgId: orgContext.orgId,
      limit,
      offset,
      filter,
    })

    const cached = await APICache.get(cacheKey)
    if (cached && !APICache.isStale(cached.timestamp, CACHE_TTL)) {
      return APICache.createCachedResponse(cached.data, {
        ttl: CACHE_TTL,
        staleWhileRevalidate: CACHE_STALE_WHILE_REVALIDATE,
      })
    }

    // Fetch notes
    const { data: notes, error: notesError } = await fetchNotesWithFilter(
      db,
      user.id,
      orgContext.orgId,
      filter,
      offset,
      limit
    )

    if (notesError) {
      return Errors.fetchFailed()
    }

    const notesList = notes || []

    if (notesList.length === 0) {
      const totalCount = await fetchTotalCount(db, user.id, orgContext.orgId)
      return NextResponse.json({
        notes: [],
        hasMore: false,
        total: totalCount,
      })
    }

    const noteIds = notesList.map((n) => n.id)

    // Fetch tabs and replies in parallel
    const [noteTabs, allReplies, totalCount] = await Promise.all([
      fetchNoteTabs(db, noteIds, orgContext.orgId),
      fetchNoteReplies(db, noteIds, orgContext.orgId),
      fetchTotalCount(db, user.id, orgContext.orgId),
    ])

    // Group by note ID
    const tabsByNoteId = groupByNoteId(noteTabs)
    const repliesByNoteId = groupByNoteId(allReplies)

    // Transform notes
    const notesWithReplies = notesList.map((note) => {
      const tabs = tabsByNoteId.get(note.id) || []
      const replies = repliesByNoteId.get(note.id) || []
      return transformNote(note, tabs, replies)
    })

    const responseData = {
      notes: notesWithReplies,
      hasMore: notesList.length === limit,
      total: totalCount,
    }

    // Cache response
    await APICache.set(cacheKey, responseData, {
      ttl: CACHE_TTL,
      tags: [`notes-${user.id}-${orgContext.orgId}`],
    })

    return APICache.createCachedResponse(responseData, {
      ttl: CACHE_TTL,
      staleWhileRevalidate: CACHE_STALE_WHILE_REVALIDATE,
    })
  } catch (err) {
    console.error(`${LOG_PREFIX} GET error:`, err)
    return Errors.internal()
  }
}

// ============================================================================
// POST - Create personal stick (note)
// ============================================================================

const createNoteAction = createSafeAction(
  {
    input: createNoteSchema,
    rateLimit: "notes_create",
  },
  async (input, { user, db }) => {
    if (!user) {
      return error("Unauthorized", 401)
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return error("No organization context", 403)
    }

    // DLP check if note is being created as shared
    if (input.is_shared) {
      const dlpResult = await checkDLPPolicy({
        orgId: orgContext.orgId,
        action: "share_note",
        userId: user.id,
        content: `${input.topic || ""} ${input.content || ""}`,
      })
      if (!dlpResult.allowed) {
        return error(dlpResult.reason || "Blocked by DLP policy", 403)
      }
    }

    const noteToCreate = createNotePayload(input, user.id, orgContext.orgId)

    const { data: note, error: dbError } = await db
      .from("personal_sticks")
      .insert([noteToCreate])
      .select(NOTE_SELECT_FIELDS)
      .single()

    if (dbError) {
      console.error(`${LOG_PREFIX} Error creating note:`, dbError)
      return error("Failed to create note", 500, {
        message: dbError.message,
      })
    }

    if (!note) {
      return error("Note was not created", 500)
    }

    // Create tabs
    await createNoteTabs(db, note.id, user.id, orgContext.orgId, {
      tags: input.tags,
      images: input.images,
      videos: input.videos,
    })

    const transformedNote: TransformedNote = {
      id: note.id,
      title: note.title || "",
      topic: note.topic || "",
      content: note.content || "",
      color: note.color || DEFAULT_COLOR,
      position_x: note.position_x || 0,
      position_y: note.position_y || 0,
      is_shared: Boolean(note.is_shared),
      z_index: note.z_index || 0,
      is_pinned: Boolean(note.is_pinned),
      tags: input.tags || [],
      images: input.images || [],
      videos: input.videos || [],
      created_at: note.created_at,
      updated_at: note.updated_at,
      user_id: note.user_id,
      org_id: note.org_id,
      replies: [],
    }

    return success(transformedNote)
  },
)

export async function POST(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  const response = await createNoteAction(request)

  if (response.ok) {
    const body = await response.json()
    const orgContext = await getOrgContext()
    if (body.userId && orgContext) {
      await APICache.invalidate(`notes:userId=${body.userId}:orgId=${orgContext.orgId}`)
    }
  }

  return response
}

// ============================================================================
// PUT - Update personal stick (note)
// ============================================================================

const updateNoteAction = createSafeAction(
  {
    input: updateNoteSchema,
    rateLimit: "notes_update",
  },
  async (input, { user, db }) => {
    if (!user) {
      return error("Unauthorized", 401)
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return error("No organization context", 403)
    }

    const { id, ...updateData } = input

    // DLP check when sharing a note
    if (updateData.is_shared === true) {
      const dlpResult = await checkDLPPolicy({
        orgId: orgContext.orgId,
        action: "share_note",
        userId: user.id,
        content: `${updateData.topic || ""} ${updateData.content || ""}`,
      })
      if (!dlpResult.allowed) {
        return error(dlpResult.reason || "Blocked by DLP policy", 403)
      }
    }

    const updatePayload = buildUpdatePayload(updateData)

    const { data: note, error: dbError } = await db
      .from("personal_sticks")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .select(NOTE_SELECT_FIELDS)
      .single()

    if (dbError) {
      console.error(`${LOG_PREFIX} Error updating note:`, dbError)
      return error("Failed to update note", 500)
    }

    if (!note) {
      return error("Note not found or you don't have permission to update it", 404)
    }

    // Update tabs if needed
    if (updateData.tags !== undefined || updateData.images !== undefined || updateData.videos !== undefined) {
      await upsertNoteTabs(db, id, user.id, orgContext.orgId, updateData)
    }

    // Fetch replies
    const { data: replies } = await db
      .from("personal_sticks_replies")
      .select(REPLY_SELECT_FIELDS)
      .eq("personal_stick_id", note.id)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    const transformedNote: TransformedNote = {
      id: note.id,
      title: note.title || "",
      topic: note.topic || "",
      content: note.content || "",
      color: note.color || DEFAULT_COLOR,
      position_x: note.position_x || 0,
      position_y: note.position_y || 0,
      is_shared: Boolean(note.is_shared),
      z_index: note.z_index || 0,
      is_pinned: Boolean(note.is_pinned),
      tags: updateData.tags || [],
      images: updateData.images || [],
      videos: updateData.videos || [],
      created_at: note.created_at,
      updated_at: note.updated_at,
      user_id: note.user_id,
      org_id: note.org_id,
      replies: ((replies || []) as ReplyRecord[]).map(transformReply),
    }

    return success(transformedNote)
  },
)

export async function PUT(request: NextRequest) {
  const response = await updateNoteAction(request)

  if (response.ok) {
    const body = await response.json()
    const orgContext = await getOrgContext()
    if (body.userId && orgContext) {
      await APICache.invalidate(`notes:userId=${body.userId}:orgId=${orgContext.orgId}`)
    }
  }

  return response
}

// ============================================================================
// DELETE - Delete personal stick (note)
// ============================================================================

export async function DELETE(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return Errors.csrf()
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const db = await createDatabaseClient()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return Errors.noOrgContext()
    }

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get("id")

    if (!noteId) {
      return Errors.noteIdRequired()
    }

    const { error: deleteError } = await db
      .from("personal_sticks")
      .delete()
      .eq("id", noteId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    if (deleteError) {
      return Errors.deleteFailed()
    }

    await APICache.invalidate(`notes:userId=${user.id}:orgId=${orgContext.orgId}`)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`${LOG_PREFIX} DELETE error:`, err)
    return Errors.internal()
  }
}
