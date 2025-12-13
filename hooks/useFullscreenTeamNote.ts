"use client"

import { useFullscreen } from "./useFullscreen"

interface TeamNote {
  id: string
  team_id: string
  topic: string
  content: string
  details?: string
  color: string
  position_x: number
  position_y: number
  user_id: string
  created_at: string
  isNew?: boolean
}

interface UseFullscreenTeamNoteProps {
  allNotes?: TeamNote[]
  onDeleteNote?: (noteId: string) => void
  onUpdateNote?: (noteId: string, updates: Partial<TeamNote>) => Promise<void>
  onUpdateNoteColor?: (id: string, color: string) => Promise<void>
}

export const useFullscreenTeamNote = (props: UseFullscreenTeamNoteProps = {}) => {
  const { allNotes = [], onDeleteNote, onUpdateNote, onUpdateNoteColor } = props

  const fullscreenHook = useFullscreen<TeamNote>("team-note", {
    allItems: allNotes,
    onDeleteItem: onDeleteNote,
    onUpdateItem: onUpdateNote,
    onUpdateItemColor: onUpdateNoteColor,
  })

  return {
    // Map generic names to specific names for backward compatibility
    fullscreenNoteId: fullscreenHook.fullscreenItemId,
    fullscreenNote: fullscreenHook.fullscreenItem,
    isFullscreenMode: fullscreenHook.isFullscreen,

    // Actions remain the same
    openFullscreen: fullscreenHook.openFullscreen,
    closeFullscreen: fullscreenHook.closeFullscreen,
    toggleFullscreen: fullscreenHook.toggleFullscreen,
    handleFullscreenKeyPress: fullscreenHook.handleFullscreenKeyPress,

    // Operations with specific names
    handleFullscreenDelete: fullscreenHook.handleFullscreenDelete,
    handleFullscreenUpdateColor: fullscreenHook.handleFullscreenUpdateColor,
    handleFullscreenUpdateNote: fullscreenHook.handleFullscreenUpdateItem,
  }
}
