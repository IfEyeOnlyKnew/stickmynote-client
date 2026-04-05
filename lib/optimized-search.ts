export interface Note {
  id: string
  user_id: string
  title: string // required by DB
  topic?: string
  content: string
  color: string
  position_x: number
  position_y: number
  is_shared: boolean
  tags: string[]
  videos: VideoItem[]
  images: ImageItem[]
  tabs?: NoteTab[]
  replies?: Reply[]
  created_at: string
  updated_at: string
  z_index?: number
  hyperlinks?: { url: string; title?: string }[]
}

export interface VideoItem {
  id: string
  url: string
  title?: string
  description?: string
  duration?: string
  thumbnail?: string
  platform?: "youtube" | "vimeo" | "rumble"
  embed_id?: string
  embed_url?: string
}

export interface ImageItem {
  id: string
  url: string
  alt?: string
  caption?: string
  size?: number
  width?: number
  height?: number
  format?: string
}

export interface NoteTab {
  id: string
  note_id: string
  tab_type: "main" | "videos" | "images" | "details"
  tab_data?: any
  videos?: VideoItem[]
  images?: ImageItem[]
  created_at: string
  updated_at: string
}

export interface Reply {
  id: string
  note_id: string
  user_id: string
  content: string
  color: string
  created_at: string
  updated_at: string
  user?: any
}

export interface SearchOptions {
  page?: number
  limit?: number
  userId?: string
}

export interface SearchResult {
  notes: Note[]
  totalCount: number
  hasMore: boolean
  page: number
}

export class OptimizedSearch {
  private static readonly DEFAULT_LIMIT = 20

  static async searchCommunityNotes(searchTerm: string, options: SearchOptions = {}): Promise<SearchResult> {
    const { page = 1, limit = this.DEFAULT_LIMIT } = options

    try {
      const params = new URLSearchParams({
        q: searchTerm,
        page: String(page),
        limit: String(limit),
      })

      const response = await fetch(`/api/community-notes/search?${params}`)
      
      if (!response.ok) {
        throw new Error("Failed to search community notes")
      }

      const data = await response.json()
      
      return {
        notes: data.notes || [],
        totalCount: data.totalCount || 0,
        hasMore: data.hasMore || false,
        page: data.page || page,
      }
    } catch (error) {
      console.error("[OptimizedSearch] Error:", error)
      throw error
    }
  }
}
