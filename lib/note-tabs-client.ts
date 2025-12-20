/**
 * Client-safe note tabs functions that call API endpoints
 * Use this in client components instead of lib/note-tabs.ts
 */

import type { NoteTab } from "@/types/note"

// Client-safe wrapper that calls API instead of direct database access
export async function getNoteTabs(noteId: string): Promise<NoteTab[]> {
  try {
    const res = await fetch(`/api/v2/notes/${noteId}/tabs`)
    if (!res.ok) {
      console.error("Failed to fetch note tabs:", res.status)
      return []
    }
    const data = await res.json()
    return data.tabs || []
  } catch (error) {
    console.error("Error fetching note tabs:", error)
    return []
  }
}

export async function saveNoteTab(
  noteId: string,
  tabType: "video" | "videos" | "images",
  data: any
): Promise<any> {
  try {
    const res = await fetch(`/api/v2/notes/${noteId}/tabs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabType, data }),
    })
    if (!res.ok) return null
    return res.json()
  } catch (error) {
    console.error("Error saving note tab:", error)
    return null
  }
}

export async function deleteNoteTabItem(
  noteId: string,
  tabType: "video" | "videos" | "images",
  itemId: string
): Promise<any> {
  try {
    const res = await fetch(`/api/v2/notes/${noteId}/tabs/${encodeURIComponent(tabType)}/${itemId}`, {
      method: "DELETE",
    })
    if (!res.ok) return null
    return res.json()
  } catch (error) {
    console.error("Error deleting note tab item:", error)
    return null
  }
}
