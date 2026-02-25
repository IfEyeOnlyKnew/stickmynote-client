import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getSession } from "@/lib/auth/local-auth"

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
  personal_stick_id: string
  tab_name: string
  tab_type: DbTabType
  tab_content: string
  tab_data: {
    videos?: VideoInfo[]
    images?: ImageInfo[]
    content?: string
    exports?: any[]
    metadata?: Record<string, string | number | boolean>
  } | null
  tab_order: number
  created_at: string
  updated_at: string
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
  exports?: any[]
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
  if (obj.exports && !Array.isArray(obj.exports)) obj.exports = []
  return obj
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

// GET /api/note-tabs?noteId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get("noteId") || ""
    if (!validateUUID(noteId)) {
      return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    // Check note ownership or sharing
    const noteResult = await db.query(
      `SELECT id, user_id, is_shared FROM personal_sticks WHERE id = $1`,
      [noteId]
    )

    if (noteResult.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const note = noteResult.rows[0]
    if (note.user_id !== userId && !note.is_shared) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get tabs
    const tabsResult = await db.query(
      `SELECT id, personal_stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at
       FROM personal_sticks_tabs
       WHERE personal_stick_id = $1
       ORDER BY tab_order ASC`,
      [noteId]
    )

    const normalized: NoteTabRow[] = tabsResult.rows.map((row: any) => ({
      ...row,
      tab_data: normalizeTabData(row.tab_data),
    }))

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
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json().catch(() => ({}))
    const noteId = String(body?.noteId || "")
    const tabType = String(body?.tabType || "")
    const items = Array.isArray(body?.items) ? body.items : []

    if (!validateUUID(noteId)) return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })
    if (!["videos", "images"].includes(tabType)) return NextResponse.json({ error: "Invalid tabType" }, { status: 400 })
    if (!items.length) return NextResponse.json({ error: "No items to merge" }, { status: 400 })

    // Verify ownership
    const noteResult = await db.query(
      `SELECT id, user_id FROM personal_sticks WHERE id = $1`,
      [noteId]
    )

    if (noteResult.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (noteResult.rows[0].user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const dbType: DbTabType = tabType === "videos" ? "video" : "images"

    // Find existing tab (check both singular and plural forms for video tabs)
    const findResult = tabType === "videos"
      ? await db.query(
          `SELECT id, tab_type, tab_data FROM personal_sticks_tabs
           WHERE personal_stick_id = $1 AND tab_type IN ('video', 'videos')
           LIMIT 1`,
          [noteId]
        )
      : await db.query(
          `SELECT id, tab_type, tab_data FROM personal_sticks_tabs
           WHERE personal_stick_id = $1 AND tab_type = $2
           LIMIT 1`,
          [noteId, dbType]
        )

    let tab = findResult.rows[0] as NoteTabRow | undefined

    if (!tab) {
      // Create new tab — always store "videos" (plural) for consistency with notes/route.ts
      const storeType = tabType === "videos" ? "videos" : "images"
      const insertResult = await db.query(
        `INSERT INTO personal_sticks_tabs
         (personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, '', $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          noteId,
          userId,
          storeType,
          storeType === "videos" ? "Videos" : "Images",
          JSON.stringify(storeType === "videos" ? { videos: [] } : { images: [] }),
          storeType === "videos" ? 1 : 2,
        ]
      )
      tab = insertResult.rows[0]
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

    await db.query(
      `UPDATE personal_sticks_tabs
       SET tab_data = $1, updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify(newTabData),
        tab.id,
      ]
    )

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
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json().catch(() => ({}))
    const noteId = String(body?.noteId || "")
    const tabType = String(body?.tabType || "")
    const itemId = String(body?.itemId || "")

    if (!validateUUID(noteId)) return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })
    if (!["videos", "images"].includes(tabType)) return NextResponse.json({ error: "Invalid tabType" }, { status: 400 })
    if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 })

    // Verify ownership
    const noteResult = await db.query(
      `SELECT id, user_id FROM personal_sticks WHERE id = $1`,
      [noteId]
    )

    if (noteResult.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (noteResult.rows[0].user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const dbType: DbTabType = tabType === "videos" ? "video" : "images"

    // Find existing tab (check both singular and plural forms for video tabs)
    const findResult = tabType === "videos"
      ? await db.query(
          `SELECT id, tab_type, tab_data FROM personal_sticks_tabs
           WHERE personal_stick_id = $1 AND tab_type IN ('video', 'videos')
           LIMIT 1`,
          [noteId]
        )
      : await db.query(
          `SELECT id, tab_type, tab_data FROM personal_sticks_tabs
           WHERE personal_stick_id = $1 AND tab_type = $2
           LIMIT 1`,
          [noteId, dbType]
        )

    const tab = findResult.rows[0]
    if (!tab) return NextResponse.json({ success: true, count: 0 })

    const baseData = normalizeTabData(tab.tab_data)
    const currentArr = (baseData?.[tabType] || []) as (VideoInfo | ImageInfo)[]
    const filtered = (currentArr || []).filter((i) => (i?.id || i?.url || "") !== itemId)
    const newTabData = { ...baseData, [tabType]: filtered }

    await db.query(
      `UPDATE personal_sticks_tabs
       SET tab_data = $1, updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify(newTabData),
        tab.id,
      ]
    )

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
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json().catch(() => ({}))
    const noteId = String(body?.noteId || "")
    const details = String(body?.details || "")

    if (!validateUUID(noteId)) return NextResponse.json({ error: "Invalid noteId" }, { status: 400 })

    // Verify ownership
    const noteResult = await db.query(
      `SELECT id, user_id FROM personal_sticks WHERE id = $1`,
      [noteId]
    )

    if (noteResult.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (noteResult.rows[0].user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const dbType: DbTabType = "details"

    // Find existing details tab
    const findResult = await db.query(
      `SELECT id, tab_type, tab_content, tab_data FROM personal_sticks_tabs
       WHERE personal_stick_id = $1 AND tab_type = $2
       LIMIT 1`,
      [noteId, dbType]
    )

    let tab = findResult.rows[0] as NoteTabRow | undefined

    if (!tab) {
      // Create new details tab
      await db.query(
        `INSERT INTO personal_sticks_tabs
         (personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at)
         VALUES ($1, $2, $3, 'Details', $4, $5, 3, NOW(), NOW())`,
        [noteId, userId, dbType, details, JSON.stringify({ content: details })]
      )
    } else {
      // Preserve existing tab_data (like exports) and only update the content
      const existingTabData = normalizeTabData(tab.tab_data)
      const updatedTabData = { ...existingTabData, content: details }

      await db.query(
        `UPDATE personal_sticks_tabs
         SET tab_content = $1, tab_data = $2, updated_at = NOW()
         WHERE id = $3`,
        [details, JSON.stringify(updatedTabData), tab.id]
      )
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
