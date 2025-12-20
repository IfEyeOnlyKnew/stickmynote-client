"use client"
import { GenericNoteTabs } from "@/components/GenericNoteTabs"
import type { NoteTabsConfig } from "@/types/note-tabs-config"
import { getNoteTabs, saveNoteTab, deleteNoteTabItem } from "@/lib/note-tabs-client"

interface NoteTabsProps {
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
  isSaving?: boolean
}

const noteTabsConfig: NoteTabsConfig = {
  getNoteTabs,
  saveNoteTab,
  deleteNoteTabItem,
  idFieldName: "noteId",
  supportsExportDeletion: false,
  isTeamNote: false,
}

export function NoteTabs(props: NoteTabsProps) {
  return <GenericNoteTabs {...props} config={noteTabsConfig} />
}
