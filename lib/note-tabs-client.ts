/**
 * Client-safe note tabs functions that call API endpoints
 * Use this in client components instead of lib/note-tabs.ts
 */

import type { NoteTab } from "@/types/note"

// Client-safe wrapper that calls /api/note-tabs (the existing working API)
export async function getNoteTabs(noteId: string): Promise<NoteTab[]> {
  try {
    const res = await fetch(`/api/note-tabs?noteId=${noteId}`)
    if (!res.ok) {
      console.error("Failed to fetch note tabs:", res.status)
      return []
    }
    const data = await res.json()
    return (data.tabs || []).map((tab: any) => ({
      id: tab.id,
      note_id: tab.personal_stick_id || noteId,
      tab_type: tab.tab_type,
      tab_data: tab.tab_data || {},
      created_at: tab.created_at,
      updated_at: tab.updated_at,
    }))
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
    // The API expects { noteId, tabType, items } where items is the array
    const mappedTabType = tabType === "video" ? "videos" : tabType
    const items = data?.[mappedTabType] || data?.[tabType] || []

    const res = await fetch(`/api/note-tabs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, tabType: mappedTabType, items }),
    })
    if (!res.ok) {
      const errorText = await res.text()
      console.error("Failed to save note tab:", res.status, errorText)
      throw new Error(`Failed to save note tab: ${res.status}`)
    }
    return res.json()
  } catch (error) {
    console.error("Error saving note tab:", error)
    throw error
  }
}

export async function deleteNoteTabItem(
  noteId: string,
  tabType: "video" | "videos" | "images",
  itemId: string
): Promise<any> {
  try {
    const mappedTabType = tabType === "video" ? "videos" : tabType

    const res = await fetch(`/api/note-tabs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, tabType: mappedTabType, itemId }),
    })
    if (!res.ok) {
      const errorText = await res.text()
      console.error("Failed to delete note tab item:", res.status, errorText)
      throw new Error(`Failed to delete note tab item: ${res.status}`)
    }
    return res.json()
  } catch (error) {
    console.error("Error deleting note tab item:", error)
    throw error
  }
}
