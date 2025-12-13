import type { NoteTab } from "@/types/note"

export interface NoteTabsConfig {
  // API functions
  getNoteTabs: (id: string) => Promise<NoteTab[]>
  saveNoteTab: (id: string, tabType: "video" | "videos" | "images", data: any) => Promise<any>
  deleteNoteTabItem: (id: string, tabType: "video" | "videos" | "images", itemId: string) => Promise<any>

  // ID field name
  idFieldName: string

  // Export functionality
  supportsExportDeletion: boolean
  isTeamNote?: boolean
  isStick?: boolean

  // Global refresh function name (optional)
  globalRefreshFunctionName?: string
}
