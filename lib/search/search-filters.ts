import { createSupabaseBrowser } from "@/lib/supabase-browser"

export interface SavedSearchFilter {
  id: string
  user_id: string
  name: string
  filters: {
    query?: string
    padIds?: string[]
    tags?: string[]
    dateRange?: { start: string; end: string }
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }
  created_at: string
}

export class SearchFilterManager {
  private supabase = createSupabaseBrowser()

  /**
   * Save a search filter
   */
  async saveFilter(name: string, filters: SavedSearchFilter["filters"]): Promise<SavedSearchFilter | null> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) {
        throw new Error("User not authenticated")
      }

      const { data, error } = await this.supabase
        .from("saved_search_filters")
        .insert({
          user_id: user.id,
          name,
          filters,
        } as any)
        .select()
        .single()

      if (error) throw error

      return data as SavedSearchFilter
    } catch (error) {
      console.error("Error saving search filter:", error)
      return null
    }
  }

  /**
   * Get all saved filters for the current user
   */
  async getSavedFilters(): Promise<SavedSearchFilter[]> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) {
        return []
      }

      const { data, error } = await this.supabase
        .from("saved_search_filters")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      return (data as SavedSearchFilter[]) || []
    } catch (error) {
      console.error("Error fetching saved filters:", error)
      return []
    }
  }

  /**
   * Delete a saved filter
   */
  async deleteFilter(filterId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.from("saved_search_filters").delete().eq("id", filterId)

      if (error) throw error

      return true
    } catch (error) {
      console.error("Error deleting filter:", error)
      return false
    }
  }

  /**
   * Update a saved filter
   */
  async updateFilter(
    filterId: string,
    updates: { name?: string; filters?: SavedSearchFilter["filters"] },
  ): Promise<SavedSearchFilter | null> {
    try {
      const { data, error } = await (this.supabase.from("saved_search_filters") as any)
        .update(updates)
        .eq("id", filterId)
        .select()
        .single()

      if (error) throw error

      return data as SavedSearchFilter
    } catch (error) {
      console.error("Error updating filter:", error)
      return null
    }
  }
}
