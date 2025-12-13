import type { VideoItem, ImageItem } from "./note"

export type TabData =
  | {
      tab_type: "videos"
      tab_data: {
        videos: VideoItem[]
      }
    }
  | {
      tab_type: "images"
      tab_data: {
        images: ImageItem[]
      }
    }
  | {
      tab_type: "details"
      tab_data: {
        content: string
        exports?: Array<{
          url: string
          created_at: string
          type?: string
        }>
      }
    }
  | {
      tab_type: "tags"
      tab_data: {
        tags: string[]
      }
    }
  | {
      tab_type: "links"
      tab_data: {
        hyperlinks: Array<{
          title: string
          url: string
        }>
      }
    }
  | {
      tab_type: "main"
      tab_data: Record<string, unknown>
    }

// Helper type guards for type narrowing
export function isVideosTab(tab: { tab_type: string; tab_data: unknown }): tab is Extract<
  TabData,
  { tab_type: "videos" }
> {
  return tab.tab_type === "videos"
}

export function isImagesTab(tab: { tab_type: string; tab_data: unknown }): tab is Extract<
  TabData,
  { tab_type: "images" }
> {
  return tab.tab_type === "images"
}

export function isDetailsTab(tab: { tab_type: string; tab_data: unknown }): tab is Extract<
  TabData,
  { tab_type: "details" }
> {
  return tab.tab_type === "details"
}

export function isTagsTab(tab: { tab_type: string; tab_data: unknown }): tab is Extract<TabData, { tab_type: "tags" }> {
  return tab.tab_type === "tags"
}

export function isLinksTab(tab: { tab_type: string; tab_data: unknown }): tab is Extract<
  TabData,
  { tab_type: "links" }
> {
  return tab.tab_type === "links"
}
