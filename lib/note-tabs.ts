import type { NoteTab } from "@/types/note"

/**
 * DB row returned by /api/note-tabs
 */
type DBNoteTabRow = {
  id: string
  note_id: string
  tab_name: string | null
  tab_type: "content" | "video" | "videos" | "images" | "details"
  tab_content?: string | null
  tab_data?: unknown
  tab_order?: number | null
  created_at?: string
  updated_at?: string
}

/**
 * Safely parse possible stringified JSON (or base64-wrapped) into an object
 */
function safeParseTabData(val: unknown): Record<string, any> {
  try {
    if (!val) return {}
    if (typeof val === "string") {
      const raw = val.startsWith("base64-") ? atob(val.slice(7)) : val
      return JSON.parse(raw)
    }
    if (typeof val === "object") return val as Record<string, any>
    return {}
  } catch {
    return {}
  }
}

/**
 * Normalize DB tab_type into UI tab_type used by the app
 * - "content" -> "main"
 * - "video"   -> "videos"
 * - "images"  -> "images"
 * - "details" -> "details"
 */
function fromDbType(dbType: DBNoteTabRow["tab_type"]): NoteTab["tab_type"] {
  if (dbType === "content") return "main"
  if (dbType === "video" || dbType === "videos") return "videos"
  if (dbType === "images") return "images"
  return "details"
}

/**
 * Map a DB row into the application's NoteTab shape.
 * Ensures tab_data.videos/images arrays are always defined.
 */
function mapRowToAppTab(row: DBNoteTabRow): NoteTab {
  const data = safeParseTabData(row.tab_data)
  const videos = Array.isArray(data?.videos) ? data.videos : []
  const images = Array.isArray(data?.images) ? data.images : []
  return {
    id: row.id,
    note_id: row.note_id,
    tab_type: fromDbType(row.tab_type),
    tab_name: row.tab_name || undefined,
    tab_data: data,
    videos,
    images,
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  } as NoteTab
}

/**
 * Load tabs for a note and normalize them for the UI.
 * Used by components/note-tabs.tsx
 */
export async function getNoteTabs(noteId: string): Promise<NoteTab[]> {
  if (!noteId) {
    return []
  }

  try {
    const res = await fetch(`/api/note-tabs?noteId=${encodeURIComponent(noteId)}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (res.status === 404 || res.status === 401) {
      return []
    }

    if (res.status === 429) {
      return []
    }

    if (!res.ok) {
      return []
    }

    let json: any
    try {
      json = await res.json()
    } catch (e) {
      return []
    }

    const rows = Array.isArray(json?.tabs) ? (json.tabs as DBNoteTabRow[]) : []
    return rows.map(mapRowToAppTab)
  } catch (error) {
    return []
  }
}

/**
 * Persist media items into note_tabs.
 * uiTabType: "videos" | "images"
 * data: either an array or an object with { videos } / { images }
 */
export async function saveNoteTab(
  noteId: string,
  uiTabType: "video" | "videos" | "images",
  data: any[] | { videos?: any[]; images?: any[] },
) {
  const tabType = uiTabType === "images" ? "images" : "videos"
  const items = Array.isArray(data) ? data : (data as any)[tabType] || []

  const res = await fetch("/api/note-tabs", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, tabType, items }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to save ${tabType} (${res.status})`)
  }
  return res.json()
}

/**
 * Delete a single media item from note_tabs by id.
 */
export async function deleteNoteTabItem(noteId: string, uiTabType: "video" | "videos" | "images", itemId: string) {
  const tabType = uiTabType === "images" ? "images" : "videos"
  const res = await fetch("/api/note-tabs", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, tabType, itemId }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to delete ${tabType} item (${res.status})`)
  }
  return res.json()
}
