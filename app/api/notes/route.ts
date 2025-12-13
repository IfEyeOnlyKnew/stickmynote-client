import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { createSafeAction, success, error } from "@/lib/safe-action"
import { createNoteSchema, updateNoteSchema } from "@/types/schemas"
import { APICache } from "@/lib/api-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// ============================================================================
// GET - Fetch personal sticks (notes)
// ============================================================================

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const supabase = await createSupabaseServer()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "20"), 100)
    const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0"), 0)
    const filter = searchParams.get("filter") || "all"

    const cacheKey = APICache.getCacheKey("notes", {
      userId: user.id,
      orgId: orgContext.orgId,
      limit,
      offset,
      filter,
    })

    const cached = await APICache.get(cacheKey)
    if (cached && !APICache.isStale(cached.timestamp, 30)) {
      return APICache.createCachedResponse(cached.data, {
        ttl: 30,
        staleWhileRevalidate: 60,
      })
    }

    let notesQuery = supabase
      .from("personal_sticks")
      .select(`
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
      `)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .order("updated_at", { ascending: false })

    if (filter === "personal") {
      notesQuery = notesQuery.eq("is_shared", false)
    } else if (filter === "shared") {
      notesQuery = notesQuery.eq("is_shared", true)
    }

    notesQuery = notesQuery.range(offset, offset + limit - 1)

    const { data: notes, error: notesError } = await notesQuery

    if (notesError) {
      return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 })
    }

    const { count: totalCount } = await supabase
      .from("personal_sticks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    const notesList = notes || []

    if (notesList.length === 0) {
      return NextResponse.json({
        notes: [],
        hasMore: false,
        total: totalCount || 0,
      })
    }

    const noteIds = notesList.map((n) => n.id)

    const { data: noteTabs, error: noteTabsError } = await supabase
      .from("personal_sticks_tabs")
      .select("personal_stick_id, tab_type, tab_data")
      .in("personal_stick_id", noteIds)
      .eq("org_id", orgContext.orgId)

    if (noteTabsError) {
      console.error("Error fetching note tabs:", noteTabsError)
    }

    const { data: allReplies, error: batchRepliesError } = await supabase
      .from("personal_sticks_replies")
      .select(`
        id,
        content,
        color,
        created_at,
        user_id,
        personal_stick_id
      `)
      .in("personal_stick_id", noteIds)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    if (batchRepliesError) {
      console.error("Error batch fetching replies:", batchRepliesError)
    }

    const tabsByNoteId = new Map()
    for (const tab of noteTabs || []) {
      const arr = tabsByNoteId.get(tab.personal_stick_id) || []
      arr.push(tab)
      tabsByNoteId.set(tab.personal_stick_id, arr)
    }

    const repliesByNoteId = new Map()
    for (const r of allReplies || []) {
      const arr = repliesByNoteId.get(r.personal_stick_id) || []
      arr.push(r)
      repliesByNoteId.set(r.personal_stick_id, arr)
    }

    const notesWithReplies = notesList.map((note) => {
      const tabs = tabsByNoteId.get(note.id) || []
      const replies = repliesByNoteId.get(note.id) || []

      let tags: string[] = []
      let images: any[] = []
      let videos: any[] = []

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
        color: note.color || "#fef3c7",
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
        replies: replies.map(
          (reply: {
            id: string
            content: string
            color: string
            created_at: string
            user_id: string
            personal_stick_id: string
          }) => ({
            id: reply.id,
            content: reply.content || "",
            color: reply.color || "#ffffff",
            created_at: reply.created_at,
            updated_at: reply.created_at,
            user_id: reply.user_id,
            note_id: reply.personal_stick_id, // Keep note_id in response for backwards compatibility
          }),
        ),
      }
    })

    const responseData = {
      notes: notesWithReplies,
      hasMore: (notes?.length || 0) === limit,
      total: totalCount || 0,
    }

    await APICache.set(cacheKey, responseData, {
      ttl: 30,
      tags: [`notes-${user.id}-${orgContext.orgId}`],
    })

    return APICache.createCachedResponse(responseData, {
      ttl: 30,
      staleWhileRevalidate: 60,
    })
  } catch (error) {
    console.error("API error in GET /api/notes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
  async (input, { user, supabase }) => {
    const orgContext = await getOrgContext()
    if (!orgContext) {
      return error("No organization context", 403)
    }

    const noteToCreate = {
      user_id: user.id,
      org_id: orgContext.orgId,
      title: input.topic || "",
      topic: input.topic || "",
      content: input.content || "",
      color: input.color || "#fef3c7",
      position_x: input.position_x || 0,
      position_y: input.position_y || 0,
      is_shared: Boolean(input.is_shared),
      z_index: input.z_index || 0,
      is_pinned: Boolean(input.is_pinned),
    }

    const { data: note, error: dbError } = await supabase
      .from("personal_sticks")
      .insert([noteToCreate])
      .select(`
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
      `)
      .single()

    if (dbError) {
      console.error("Error creating note:", dbError)
      return error("Failed to create note", 500, {
        message: dbError.message,
      })
    }

    if (!note) {
      return error("Note was not created", 500)
    }

    const tabsToCreate = []

    if (input.tags && input.tags.length > 0) {
      tabsToCreate.push({
        personal_stick_id: note.id, // Renamed from note_id
        user_id: user.id,
        org_id: orgContext.orgId,
        tab_type: "details",
        tab_name: "Tags",
        tab_data: { tags: input.tags },
      })
    }

    if (input.images && input.images.length > 0) {
      tabsToCreate.push({
        personal_stick_id: note.id, // Renamed from note_id
        user_id: user.id,
        org_id: orgContext.orgId,
        tab_type: "images",
        tab_name: "Images",
        tab_data: { images: input.images },
      })
    }

    if (input.videos && input.videos.length > 0) {
      tabsToCreate.push({
        personal_stick_id: note.id, // Renamed from note_id
        user_id: user.id,
        org_id: orgContext.orgId,
        tab_type: "videos",
        tab_name: "Videos",
        tab_data: { videos: input.videos },
      })
    }

    if (tabsToCreate.length > 0) {
      const { error: tabsError } = await supabase.from("personal_sticks_tabs").insert(tabsToCreate)
      if (tabsError) {
        console.error("Error creating note tabs:", tabsError)
      }
    }

    const transformedNote = {
      id: note.id,
      title: note.title || "",
      topic: note.topic || "",
      content: note.content || "",
      color: note.color || "#fef3c7",
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
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
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
  async (input, { user, supabase }) => {
    const orgContext = await getOrgContext()
    if (!orgContext) {
      return error("No organization context", 403)
    }

    const { id, ...updateData } = input

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    }

    if (updateData.topic !== undefined) {
      updatePayload.topic = updateData.topic
      updatePayload.title = updateData.topic
    }
    if (updateData.content !== undefined) updatePayload.content = updateData.content
    if (updateData.color !== undefined) updatePayload.color = updateData.color
    if (updateData.position_x !== undefined) updatePayload.position_x = updateData.position_x
    if (updateData.position_y !== undefined) updatePayload.position_y = updateData.position_y
    if (updateData.is_shared !== undefined) updatePayload.is_shared = Boolean(updateData.is_shared)
    if (updateData.z_index !== undefined) updatePayload.z_index = updateData.z_index
    if (updateData.is_pinned !== undefined) updatePayload.is_pinned = Boolean(updateData.is_pinned)

    const { data: note, error: dbError } = await supabase
      .from("personal_sticks")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .select(`
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
      `)
      .single()

    if (dbError) {
      console.error("Error updating note:", dbError)
      return error("Failed to update note", 500)
    }

    if (!note) {
      return error("Note not found or you don't have permission to update it", 404)
    }

    if (updateData.tags !== undefined || updateData.images !== undefined || updateData.videos !== undefined) {
      const tabUpdates = []

      if (updateData.tags !== undefined) {
        tabUpdates.push({
          personal_stick_id: id, // Renamed from note_id
          user_id: user.id,
          org_id: orgContext.orgId,
          tab_type: "details",
          tab_name: "Tags",
          tab_data: { tags: updateData.tags },
        })
      }

      if (updateData.images !== undefined) {
        tabUpdates.push({
          personal_stick_id: id, // Renamed from note_id
          user_id: user.id,
          org_id: orgContext.orgId,
          tab_type: "images",
          tab_name: "Images",
          tab_data: { images: updateData.images },
        })
      }

      if (updateData.videos !== undefined) {
        tabUpdates.push({
          personal_stick_id: id, // Renamed from note_id
          user_id: user.id,
          org_id: orgContext.orgId,
          tab_type: "videos",
          tab_name: "Videos",
          tab_data: { videos: updateData.videos },
        })
      }

      for (const tabUpdate of tabUpdates) {
        await supabase.from("personal_sticks_tabs").upsert(tabUpdate, {
          onConflict: "personal_stick_id,tab_type",
          ignoreDuplicates: false,
        })
      }
    }

    const { data: replies } = await supabase
      .from("personal_sticks_replies")
      .select(`
        id,
        content,
        color,
        created_at,
        user_id,
        personal_stick_id
      `)
      .eq("personal_stick_id", note.id)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    const transformedNote = {
      id: note.id,
      title: note.title || "",
      topic: note.topic || "",
      content: note.content || "",
      color: note.color || "#fef3c7",
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
      replies: (replies || []).map((reply) => ({
        id: reply.id,
        content: reply.content || "",
        color: reply.color || "#ffffff",
        created_at: reply.created_at,
        updated_at: reply.created_at,
        user_id: reply.user_id,
        note_id: reply.personal_stick_id, // Keep note_id in response for backwards compatibility
      })),
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
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const supabase = await createSupabaseServer()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get("id")

    if (!noteId) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("personal_sticks")
      .delete()
      .eq("id", noteId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
    }

    await APICache.invalidate(`notes:userId=${user.id}:orgId=${orgContext.orgId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error in DELETE /api/notes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
