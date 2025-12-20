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
  /**
   * Save a search filter
   */
  async saveFilter(name: string, filters: SavedSearchFilter["filters"]): Promise<SavedSearchFilter | null> {
    try {
      const response = await fetch("/api/search-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters }),
      })

      if (!response.ok) {
        throw new Error("Failed to save filter")
      }

      const data = await response.json()
      return data.filter as SavedSearchFilter
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
      const response = await fetch("/api/search-filters")

      if (!response.ok) {
        throw new Error("Failed to fetch filters")
      }

      const data = await response.json()
      return data.filters || []
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
      const response = await fetch(`/api/search-filters/${filterId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete filter")
      }

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
      const response = await fetch(`/api/search-filters/${filterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error("Failed to update filter")
      }

      const data = await response.json()
      return data.filter as SavedSearchFilter
    } catch (error) {
      console.error("Error updating filter:", error)
      return null
    }
  }
}
