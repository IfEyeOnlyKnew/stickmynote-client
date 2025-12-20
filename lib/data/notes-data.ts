import { createDatabaseClient } from "@/lib/database/database-adapter"
import type { Note } from "@/types/note"
import { unstable_cache } from "next/cache"
import { CACHE_TAGS, CACHE_DURATIONS } from "@/lib/cache-config"

export async function fetchUserNotes(userId: string, limit = 50): Promise<Note[]> {
  return unstable_cache(
    async () => {
      const db = await createDatabaseClient()

      const { data, error } = await db
        .from("notes")
        .select(`
          id, topic, content, color, position_x, position_y, is_shared, 
          tags, images, videos, created_at, updated_at, user_id
        `)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit)

      if (error) {
        console.error("Error fetching notes:", error)
        throw new Error("Failed to fetch notes")
      }

      return (data || []) as Note[]
    },
    [`notes-${userId}-${limit}`],
    {
      tags: [CACHE_TAGS.notes(userId)],
      revalidate: CACHE_DURATIONS.notes,
    },
  )()
}

export async function fetchNoteStats(userId: string) {
  return unstable_cache(
    async () => {
      const db = await createDatabaseClient()

      const { data: allNotes } = await db.from("notes").select("id, is_shared").eq("user_id", userId)

      const total = allNotes?.length || 0
      const personal = allNotes?.filter((n) => !n.is_shared).length || 0
      const shared = allNotes?.filter((n) => n.is_shared).length || 0

      return { total, personal, shared }
    },
    [`note-stats-${userId}`],
    {
      tags: [CACHE_TAGS.noteStats(userId)],
      revalidate: CACHE_DURATIONS.noteStats,
    },
  )()
}
