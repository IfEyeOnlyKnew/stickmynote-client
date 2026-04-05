"use client"
import { GenericNoteTabs } from "@/components/GenericNoteTabs"
import type { NoteTabsConfig } from "@/types/note-tabs-config"
import { getInferenceStickTabs, saveInferenceStickTab, deleteInferenceStickTabItem } from "@/lib/inference-stick-tabs"

interface InferenceStickTabsProps {
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
  stickType?: "personal" | "concur" | "alliance" | "inference"
}

const inferenceStickTabsConfig: NoteTabsConfig = {
  getNoteTabs: getInferenceStickTabs,
  saveNoteTab: saveInferenceStickTab,
  deleteNoteTabItem: deleteInferenceStickTabItem,
  idFieldName: "inferenceStickId",
  supportsExportDeletion: false,
  isTeamNote: false,
}

export function InferenceStickTabs(props: Readonly<InferenceStickTabsProps>) {
  return <GenericNoteTabs {...props} config={inferenceStickTabsConfig} />
}
