// Shared handler logic for stick tabs (v1 + v2 deduplication)

// Types
export type DbTabType = "main" | "details" | "images" | "videos" | "tags" | "links"

export interface VideoInfo {
  id: string
  url: string
  title?: string
  thumbnail?: string
  duration?: string | number
  platform?: "youtube" | "vimeo" | "rumble"
  embed_id?: string
  embed_url?: string
  added_at?: string
}

export interface ImageInfo {
  id: string
  url: string
  title?: string
  alt?: string
  caption?: string
  size?: number
  type?: string
  width?: number
  height?: number
}

export interface ExportLink {
  url: string
  filename: string
  created_at: string
  type: string
}

export interface StickTabRow {
  id: string
  stick_id: string
  tab_name: string
  tab_type: DbTabType
  tab_content: string
  tab_data: {
    videos?: VideoInfo[]
    images?: ImageInfo[]
    content?: string
    metadata?: Record<string, string | number | boolean>
    tags?: string[]
    links?: string[]
    exports?: ExportLink[]
  } | null
  tab_order: number
  created_at: string
  updated_at: string
  org_id: string
}

// Helper: Get tab name based on tab_type
export function getTabName(tabType: string): string {
  const tabNames: Record<string, string> = {
    videos: "Videos",
    images: "Images",
    tags: "Tags",
    links: "Links",
  }
  return tabNames[tabType] || "Details"
}

// Helper: Get tab order based on tab_type
export function getTabOrder(tabType: string): number {
  const tabOrders: Record<string, number> = {
    videos: 1,
    images: 2,
    tags: 3,
    links: 4,
  }
  return tabOrders[tabType] ?? 5
}

export function normalizeTabData(input: any): {
  videos?: VideoInfo[]
  images?: ImageInfo[]
  content?: string
  metadata?: Record<string, string | number | boolean>
  tags?: string[]
  links?: string[]
  exports?: ExportLink[]
  [k: string]: any
} {
  let obj: any = input
  try {
    if (obj && typeof obj === "string") {
      obj = JSON.parse(obj)
    }
  } catch {
    obj = {}
  }
  if (!obj || typeof obj !== "object") obj = {}
  if (obj.videos && !Array.isArray(obj.videos)) obj.videos = []
  if (obj.images && !Array.isArray(obj.images)) obj.images = []
  if (obj.tags && !Array.isArray(obj.tags)) obj.tags = []
  if (obj.links && !Array.isArray(obj.links)) obj.links = []
  if (obj.exports && !Array.isArray(obj.exports)) obj.exports = []
  return obj
}

// Helper: Create tab item based on type
export function createTabItem(
  tabType: string,
  url: string | undefined,
  title: string | undefined,
  type: string | undefined,
  thumbnail: string | undefined,
  metadata: Record<string, any> | undefined,
): { key: string; item: any } | null {
  const now = Date.now()
  const isoNow = new Date().toISOString()

  if (tabType === "videos" && url) {
    return {
      key: "videos",
      item: {
        id: `video_${now}`,
        url,
        title: title || `Video ${now}`,
        thumbnail,
        added_at: isoNow,
        ...metadata,
      } as VideoInfo,
    }
  }

  if (tabType === "images" && url) {
    return {
      key: "images",
      item: {
        id: `image_${now}`,
        url,
        title: title || `Image ${now}`,
        ...metadata,
      } as ImageInfo,
    }
  }

  if (tabType === "tags" && type) {
    return { key: "tags", item: type }
  }

  if (tabType === "links" && url) {
    return { key: "links", item: url }
  }

  return null
}

// Applies a new item to tab_data based on tab_type and body fields.
// Used by both v1 and v2 POST handlers.
export function applyNewItemToTabData(
  tabData: Record<string, any>,
  body: { tab_type: string; type?: string; url?: string; title?: string; thumbnail?: string; metadata?: Record<string, any> },
): Record<string, any> {
  const newItem = createTabItem(body.tab_type, body.url, body.title, body.type, body.thumbnail, body.metadata)
  if (newItem) {
    const key = newItem.key
    const currentItems = (tabData[key] as any[]) || []
    tabData[key] = [...currentItems, newItem.item]
  }
  return tabData
}

// Default tabs to create when no tabs exist for a stick
export function getDefaultTabInserts(stickId: string, userId: string, orgId: string) {
  return [
    {
      stick_id: stickId,
      user_id: userId,
      org_id: orgId,
      tab_name: "Main",
      tab_type: "main" as DbTabType,
      tab_content: "",
      tab_data: {},
      tab_order: 0,
    },
    {
      stick_id: stickId,
      user_id: userId,
      org_id: orgId,
      tab_name: "Details",
      tab_type: "details" as DbTabType,
      tab_content: "",
      tab_data: {},
      tab_order: 1,
    },
  ]
}

// Standard tab select columns
export const TAB_SELECT_COLUMNS = "id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id"
