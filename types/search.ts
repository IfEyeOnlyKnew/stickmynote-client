export interface SavedSearch {
  id: string
  user_id: string
  name: string
  query: string
  filters: SearchFilters
  created_at: string
  updated_at: string
}

export interface SearchFilters {
  dateRange?: {
    from: Date | null
    to: Date | null
  }
  author?: string
  pad?: string
  tags?: string[]
  color?: string
  shared?: boolean | null
}

export interface AdvancedSearchParams {
  query: string
  filters: SearchFilters
  page?: number
  limit?: number
  sortBy?: "created_at" | "updated_at" | "relevance"
  sortOrder?: "asc" | "desc"
}
