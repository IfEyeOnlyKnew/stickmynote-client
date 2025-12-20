import type { Note } from "@/types/note"

/**
 * Fetches community shared notes via the API
 * Uses /api/community-notes/search endpoint for server-side querying
 */
export async function getCommunitySharedNotes(searchTerm: string): Promise<Note[]> {
  if (!searchTerm.trim()) {
    return []
  }

  try {
    const response = await fetch(`/api/community-notes/search?q=${encodeURIComponent(searchTerm)}&limit=100`)
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Not authenticated")
      }
      const data = await response.json()
      throw new Error(data.error || "Failed to fetch community notes")
    }

    const data = await response.json()
    return data.notes || []
  } catch (error) {
    console.error("Error fetching community notes:", error)
    throw error
  }
}
