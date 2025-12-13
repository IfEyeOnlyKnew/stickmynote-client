"use client"
import { GenericNoteTabs } from "@/components/GenericNoteTabs"
import type { NoteTabsConfig } from "@/types/note-tabs-config"
import { getSocialStickTabs, saveSocialStickTab, deleteSocialStickTabItem } from "@/lib/social-stick-tabs"

interface SocialStickTabsProps {
  noteId: string
  initialTopic: string
  initialContent: string
  initialDetails?: string
  onTopicChange: (value: string) => void
  onContentChange: (value: string) => void
  onDetailsChange?: (value: string) => void
  onTopicFocus?: () => void
  onContentFocus?: () => void
  readOnly?: boolean
  resetKey?: number
  onTabChange?: (tabName: string) => void
  showMedia?: boolean
  isEditing?: boolean
  onCancel?: () => void
  onStick?: () => void
}

const socialStickTabsConfig: NoteTabsConfig = {
  getNoteTabs: getSocialStickTabs,
  saveNoteTab: saveSocialStickTab,
  deleteNoteTabItem: deleteSocialStickTabItem,
  idFieldName: "socialStickId",
  supportsExportDeletion: false,
  isTeamNote: false,
}

export function SocialStickTabs(props: SocialStickTabsProps) {
  return <GenericNoteTabs {...props} config={socialStickTabsConfig} />
}
