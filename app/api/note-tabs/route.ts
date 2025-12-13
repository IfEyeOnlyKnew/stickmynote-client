import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

// Types
type DbTabType = "content" | "video" | "images" | "details"

interface VideoInfo {
  id: string
  url: string
  title?: string
  thumbnail?: string
  duration?: string | number
  platform?: "youtube" | "vimeo" | "rumble"
  embed_id?: string
  embed_url?: string
  added_at?: string
}

interface ImageInfo {
  id: string
  url: string
  title?: string
  alt?: string
  caption?: string
  size?: number
  type?: string
  width?: number
  height?: number
}

interface NoteTabRow {
  id: string
  personal_stick_id: string // Renamed from note_id
  tab_name: string
  tab_type: DbTabType
  tab_content: string
  tab_data: {
    videos?: VideoInfo[]
    images?: ImageInfo[]
    content?: string
    metadata?: Record<string, string | number | boolean>
  } | null
  tab_order: number
  created_at: string
  updated_at: string
}

interface NoteRow {
  id: string
  user_id: string
  is_shared: boolean
  org_id: string
}

// Utilities
function validateUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function decodeBase64Maybe(value: string): string {
  try {
    const raw = value.startsWith("base64-") ? value.slice(7) : value
    return Buffer.from(raw, "base64").toString("utf8")
  } catch {
    return value
  }
}

function normalizeTabData(input: any): {
  videos?: VideoInfo[]
  images?: ImageInfo[]
  [k: string]: any
} {
  let obj: any = input
  try {
    if (obj && typeof obj === "string") {
      const asText = obj.startsWith("{") || obj.startsWith("[") ? obj : decodeBase64Maybe(obj)
      obj = JSON.parse(asText)
    }
  } catch {
    obj = {}
  }
  if (!obj || typeof obj !== "object") obj = {}
  if (obj.videos && !Array.isArray(obj.videos)) obj.videos = []
  if (obj.images && !Array.isArray(obj.images)) obj.images = []
  return obj
}

function parseUrlsFromText(s?: string | null): string[] {
  if (!s || typeof s !== "string") return []
  const re = /\bhttps?:\/\/[^\s)'"<>]+/gi
  const urls = s.match(re) || []
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    if (!seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

function extractVideoInfo(url: string): VideoInfo | null {
  try {
    const u = new URL(url)

    // YouTube
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let id = ""
      if (u.hostname.includes("youtu.be")) id = u.pathname.replace("/", "")
      else id = u.searchParams.get("v") || ""
      if (id) {
        return {
          id,
          url,
          title: `YouTube ${id}`,
          thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
          platform: "youtube",
          embed_id: id,
          embed_url: `https://www.youtube.com/embed/${id}?rel=0`,
          added_at: new Date().toISOString(),
        }
      }
    }

    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0]
      if (id) {
        return {
          id,
          url,
          title: `Vimeo ${id}`,
          thumbnail: `https://vumbnail.com/${id}.jpg`,
          platform: "vimeo",
          embed_id: id,
          embed_url: `https://player.vimeo.com/video/${id}`,
          added_at: new Date().toISOString(),
        }
      }
    }

    // Rumble
    if (u.hostname.includes("rumble.com")) {
      const parts = u.pathname.split("/").filter(Boolean)
      const id = parts[parts.length - 1] || parts[parts.length - 2]
      if (id) {
        return {
          id,
          url,
          title: `Rumble ${id}`,
          platform: "rumble",
          embed_id: id,
          embed_url: `https://rumble.com/embed/${id}/`,
          added_at: new Date().toISOString(),
        }
      }
    }

    // Unknown platform: still keep URL
    return {
      id: `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      url,
      title: "",
      added_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function dedupeByIdOrUrl<T extends { id?: string; url?: string }>(items: T[]) {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    const key = (it.id || it.url || "").trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

async function getUser(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const authResult = await getCachedAuthUser(supabase)
  if (authResult.rateLimited) return { user: null, rateLimited: true }
  return { user: authResult.user, rateLimited: false }
}

async function getNote(supabase: Awaited<ReturnType<typeof createSupabaseServer>>, noteId: string) {
  const { data, error } = await supabase
    .from("personal_sticks")
    .select("id,user_id,is_shared,org_id")
    .eq("id", noteId)
    .single()
  if (error) return null
  return data as NoteRow & { org_id: string }
}

function isUserIdColumnError(err: any) {
  const msg = String(err?.message || "")
  const code = String(err?.code || "")
  return code === "42703" || msg.includes('column "user_id"') || msg.includes("user_id")
}

async function safeInsertNoteTab(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  payload: any,
  userId: string,
) {
  let ins = await supabase
    .from("personal_sticks_tabs")
    .insert({ ...payload, user_id: userId })
    .select("*")
    .single()
  if (ins.error && isUserIdColumnError(ins.error)) {
    ins = await supabase.from("personal_sticks_tabs").insert(payload).select("*").single()
  }
  if (ins.error) throw ins.error
  return ins.data
}

// Helper function for secure organization access check
function canAccessNote(note: NoteRow, userId: string, userOrgId: string | null): { allowed: boolean; reason?: string } {
  const isOwner = note.user_id === userId
  const noteOrgId = note.org_id || null

  if (isOwner) {
    return { allowed: true }
  }

  if (note.is_shared) {
    if (!noteOrgId) {
      return { allowed: true }
    }
    if (noteOrgId && userOrgId === noteOrgId) {
      return { allowed: true }
    }
    if (noteOrgId && userOrgId !== noteOrgId) {
      return { allowed: false, reason: "Note belongs to a different organization" }
    }
  }

  return { allowed: false, reason: "Access denied" }
}

// Helper function for write access (owner only, with org check for org notes)
function canModifyNote(note: NoteRow, userId: string, userOrgId: string | null): { allowed: boolean; reason?: string } {
  const isOwner = note.user_id === userId
  const noteOrgId = note.org_id || null

  if (!isOwner) {
    return { allowed: false, reason: "Only the note owner can modify" }
  }

  if (!noteOrgId) {
    return { allowed: true }
  }

  if (noteOrgId) {
    if (!userOrgId) {
      return { allowed: true }
    }
    if (userOrgId !== noteOrgId) {
      return { allowed: false, reason: "Note belongs to a different organization" }
    }
  }

  return { allowed: true }
}

// GET /api/note-tabs?noteId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get("noteId") || ""
    if (!validateUUID(noteId)) {
      return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })
    }

    const supabase = await createSupabaseServer()
    const { user, rateLimited } = await getUser(supabase)
    if (rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const orgContext = await getOrgContext(user.id)
    const userOrgId = orgContext?.orgId || null

    const note = await getNote(supabase, noteId)
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const accessCheck = canAccessNote(note, user.id, userOrgId)
    if (!accessCheck.allowed) {
      return NextResponse.json({ error: accessCheck.reason || "Forbidden" }, { status: 403 })
    }

    const noteOrgId = note.org_id || null

    let query = supabase
      .from("personal_sticks_tabs")
      .select("id, personal_stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at")
      .eq("personal_stick_id", noteId)
      .order("tab_order", { ascending: true })

    if (noteOrgId) {
      query = query.eq("org_id", noteOrgId)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const normalized: NoteTabRow[] = []

    for (const row of data || []) {
      const typedRow = row as NoteTabRow
      const tab_data = normalizeTabData(typedRow.tab_data)
      normalized.push({ ...typedRow, tab_data })
    }

    return NextResponse.json({ tabs: normalized })
  } catch (err: any) {
    console.error("GET /api/note-tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/note-tabs  (merge media items)
// Body: { noteId: string, tabType: 'videos'|'images', items: VideoInfo[] | ImageInfo[] }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const { user, rateLimited } = await getUser(supabase)
    if (rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const orgContext = await getOrgContext(user.id)
    const userOrgId = orgContext?.orgId || null

    const body = await request.json().catch(() => ({}))
    const noteId = String(body?.noteId || "")
    const tabType = String(body?.tabType || "")
    const items = Array.isArray(body?.items) ? body.items : []

    if (!validateUUID(noteId)) return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })
    if (!["videos", "images"].includes(tabType)) return NextResponse.json({ error: "Invalid tabType" }, { status: 400 })
    if (!items.length) return NextResponse.json({ error: "No items to merge" }, { status: 400 })

    const note = await getNote(supabase, noteId)
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const modifyCheck = canModifyNote(note, user.id, userOrgId)
    if (!modifyCheck.allowed) {
      return NextResponse.json({ error: modifyCheck.reason || "Forbidden" }, { status: 403 })
    }

    const noteOrgId = note.org_id || null

    const dbType: DbTabType = tabType === "videos" ? "video" : "images"

    let findQuery = supabase
      .from("personal_sticks_tabs")
      .select("id, tab_type, tab_data")
      .eq("personal_stick_id", noteId)
      .eq("tab_type", dbType)
      .limit(1)

    if (noteOrgId) {
      findQuery = findQuery.eq("org_id", noteOrgId)
    }

    const { data: rows, error: findErr } = await findQuery

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

    let tab = rows?.[0] as NoteTabRow | undefined
    if (!tab) {
      const payload = {
        personal_stick_id: noteId, // Renamed from note_id
        tab_type: dbType,
        tab_name: dbType === "video" ? "Videos" : "Images",
        tab_content: "",
        tab_data: dbType === "video" ? { videos: [] } : { images: [] },
        tab_order: dbType === "video" ? 1 : 2,
        ...(noteOrgId ? { org_id: noteOrgId } : {}),
      }
      try {
        tab = await safeInsertNoteTab(supabase, payload, user.id)
      } catch (e: any) {
        console.error("Insert note_tab failed:", e)
        return NextResponse.json({ error: e?.message || "Insert failed" }, { status: 500 })
      }
    }

    if (!tab) {
      return NextResponse.json({ error: "Failed to create or find tab" }, { status: 500 })
    }

    const baseData = normalizeTabData(tab?.tab_data)
    const currentArr = (baseData?.[tabType] || []) as (VideoInfo | ImageInfo)[]

    const normalizedIncoming: (VideoInfo | ImageInfo)[] =
      tabType === "videos"
        ? (items as any[]).map((it) => {
            const asUrl = (it?.url as string) || (it?.embed_url as string) || ""
            if (asUrl) {
              return { ...extractVideoInfo(asUrl), ...it } as VideoInfo
            }
            return it as VideoInfo
          })
        : (items as ImageInfo[]).map((img, idx) => {
            const { id, ...imgWithoutId } = img
            return {
              id: id || `image_${Date.now()}_${idx}`,
              ...imgWithoutId,
            }
          })

    const merged = dedupeByIdOrUrl([...(currentArr || []), ...normalizedIncoming])
    const newTabData = { ...baseData, [tabType]: merged }

    let updateQuery = supabase
      .from("personal_sticks_tabs")
      .update({
        tab_type: dbType,
        tab_name: dbType === "video" ? "Videos" : "Images",
        tab_data: newTabData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tab.id)

    if (noteOrgId) {
      updateQuery = updateQuery.eq("org_id", noteOrgId)
    }

    const { error: updateErr } = await updateQuery

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      count: merged.length,
      tabType,
    })
  } catch (err) {
    console.error("POST /api/note-tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/note-tabs  (remove media item)
// Body: { noteId: string, tabType: 'videos'|'images', itemId: string }
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const { user, rateLimited } = await getUser(supabase)
    if (rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const orgContext = await getOrgContext(user.id)
    const userOrgId = orgContext?.orgId || null

    const body = await request.json().catch(() => ({}))
    const noteId = String(body?.noteId || "")
    const tabType = String(body?.tabType || "")
    const itemId = String(body?.itemId || "")

    if (!validateUUID(noteId)) return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })
    if (!["videos", "images"].includes(tabType)) return NextResponse.json({ error: "Invalid tabType" }, { status: 400 })
    if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 })

    const note = await getNote(supabase, noteId)
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const modifyCheck = canModifyNote(note, user.id, userOrgId)
    if (!modifyCheck.allowed) {
      return NextResponse.json({ error: modifyCheck.reason || "Forbidden" }, { status: 403 })
    }

    const noteOrgId = note.org_id || null

    const dbType: DbTabType = tabType === "videos" ? "video" : "images"

    let findQuery = supabase
      .from("personal_sticks_tabs")
      .select("id, tab_type, tab_data")
      .eq("personal_stick_id", noteId)
      .eq("tab_type", dbType)
      .limit(1)

    if (noteOrgId) {
      findQuery = findQuery.eq("org_id", noteOrgId)
    }

    const { data: rows, error: findErr } = await findQuery

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

    const tab = rows?.[0]
    if (!tab) return NextResponse.json({ success: true, count: 0 })

    const baseData = normalizeTabData(tab.tab_data)
    const currentArr = (baseData?.[tabType] || []) as (VideoInfo | ImageInfo)[]
    const filtered = (currentArr || []).filter((i) => (i?.id || i?.url || "") !== itemId)
    const newTabData = { ...baseData, [tabType]: filtered }

    let updateQuery = supabase
      .from("personal_sticks_tabs")
      .update({
        tab_type: dbType,
        tab_name: dbType === "video" ? "Videos" : "Images",
        tab_data: newTabData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tab.id)

    if (noteOrgId) {
      updateQuery = updateQuery.eq("org_id", noteOrgId)
    }

    const { error: updateErr } = await updateQuery

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ success: true, count: filtered.length })
  } catch (err) {
    console.error("DELETE /api/note-tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/note-tabs  (handle details tab updates)
// Body: { noteId: string, details: string }
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const { user, rateLimited } = await getUser(supabase)
    if (rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const orgContext = await getOrgContext(user.id)
    const userOrgId = orgContext?.orgId || null

    const body = await request.json().catch(() => ({}))
    const noteId = String(body?.noteId || "")
    const details = String(body?.details || "")

    if (!validateUUID(noteId)) return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })

    const note = await getNote(supabase, noteId)
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const modifyCheck = canModifyNote(note, user.id, userOrgId)
    if (!modifyCheck.allowed) {
      return NextResponse.json({ error: modifyCheck.reason || "Forbidden" }, { status: 403 })
    }

    const noteOrgId = note.org_id || null

    const dbType: DbTabType = "details"

    let findQuery = supabase
      .from("personal_sticks_tabs")
      .select("id, tab_type, tab_content, tab_data")
      .eq("personal_stick_id", noteId)
      .eq("tab_type", dbType)
      .limit(1)

    if (noteOrgId) {
      findQuery = findQuery.eq("org_id", noteOrgId)
    }

    const { data: rows, error: findErr } = await findQuery

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

    let tab = rows?.[0] as NoteTabRow | undefined
    if (!tab) {
      const payload = {
        personal_stick_id: noteId, // Renamed from note_id
        tab_type: dbType,
        tab_name: "Details",
        tab_content: details,
        tab_data: { content: details },
        tab_order: 3,
        ...(noteOrgId ? { org_id: noteOrgId } : {}),
      }
      try {
        tab = await safeInsertNoteTab(supabase, payload, user.id)
      } catch (e: any) {
        console.error("Insert details tab failed:", e)
        return NextResponse.json({ error: e?.message || "Insert failed" }, { status: 500 })
      }
    } else {
      let updateQuery = supabase
        .from("personal_sticks_tabs")
        .update({
          tab_content: details,
          tab_data: { content: details },
          updated_at: new Date().toISOString(),
        })
        .eq("id", tab.id)

      if (noteOrgId) {
        updateQuery = updateQuery.eq("org_id", noteOrgId)
      }

      const { error: updateErr } = await updateQuery

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      details,
    })
  } catch (err) {
    console.error("PUT /api/note-tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
