import type { StickTab } from "@/types/pad"

export interface StickTabsConfig {
  // API functions
  getStickTabs: (id: string) => Promise<StickTab[]>
  saveStickTab: (id: string, tabType: "video" | "videos" | "images", data: any) => Promise<any>
  deleteStickTabItem: (id: string, tabType: "video" | "videos" | "images", itemId: string) => Promise<any>

  // ID field name
  idFieldName: string

  // Export functionality
  supportsExportDeletion: boolean
  isStick?: boolean

  // Global refresh function name (optional)
  globalRefreshFunctionName?: string
}
