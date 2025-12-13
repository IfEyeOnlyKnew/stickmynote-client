import { createServerClient } from "@/lib/supabase/server"

export interface SearchEvent {
  user_id: string
  query: string
  filters?: Record<string, any>
  results_count: number
  clicked_note_id?: string
}

export interface SearchClickEvent {
  user_id: string
  query: string
  note_id: string
  position: number
}

export class SearchAnalytics {
  static async trackSearch(event: SearchEvent): Promise<void> {
    try {
      const supabase = await createServerClient()

      await supabase.from("search_history").insert({
        user_id: event.user_id,
        query: event.query,
        filters: event.filters || {},
        results_count: event.results_count,
        clicked_note_id: event.clicked_note_id || null,
      })
    } catch (error) {
      console.error("[v0] Failed to track search:", error)
    }
  }

  static async trackClick(event: SearchClickEvent): Promise<void> {
    try {
      const supabase = await createServerClient()

      // Find the most recent search for this query by this user
      const { data: recentSearch } = await supabase
        .from("search_history")
        .select("id")
        .eq("user_id", event.user_id)
        .eq("query", event.query)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (recentSearch) {
        // Update the search history entry with the clicked note
        await supabase.from("search_history").update({ clicked_note_id: event.note_id }).eq("id", recentSearch.id)
      }
    } catch (error) {
      console.error("[v0] Failed to track click:", error)
    }
  }

  // Get trending searches
  static async getTrendingSearches(limit = 10): Promise<string[]> {
    try {
      const supabase = await createServerClient()

      const { data } = await supabase
        .from("search_history")
        .select("query")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(100)

      if (!data) return []

      // Count frequency
      const queryCounts = data.reduce((acc: Record<string, number>, { query }) => {
        acc[query] = (acc[query] || 0) + 1
        return acc
      }, {})

      // Sort by frequency and return top results
      return Object.entries(queryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([query]) => query)
    } catch (error) {
      console.error("[v0] Failed to get trending searches:", error)
      return []
    }
  }

  static async getPopularNotes(limit = 10): Promise<string[]> {
    try {
      const supabase = await createServerClient()

      const { data } = await supabase
        .from("search_history")
        .select("clicked_note_id")
        .not("clicked_note_id", "is", null)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100)

      if (!data) return []

      // Count frequency
      const noteCounts = data.reduce((acc: Record<string, number>, { clicked_note_id }) => {
        if (clicked_note_id) {
          acc[clicked_note_id] = (acc[clicked_note_id] || 0) + 1
        }
        return acc
      }, {})

      // Sort by frequency and return top results
      return Object.entries(noteCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([noteId]) => noteId)
    } catch (error) {
      console.error("[v0] Failed to get popular notes:", error)
      return []
    }
  }
}
