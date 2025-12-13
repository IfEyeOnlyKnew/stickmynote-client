"use client"

import { useFullscreen } from "./useFullscreen"
import type { Note } from "@/types/note"

interface UseFullscreenNoteProps {
  allNotes?: Note[]
  onDeleteNote?: (noteId: string) => void
  onUpdateNote?: (noteId: string, updates: Partial<Note>) => Promise<void>
  onUpdateNoteSharing?: (id: string, isShared: boolean) => Promise<void>
  onUpdateNoteColor?: (id: string, color: string) => Promise<void>
}

export const useFullscreenNote = (props: UseFullscreenNoteProps = {}) => {
  const { allNotes = [], onDeleteNote, onUpdateNote, onUpdateNoteSharing, onUpdateNoteColor } = props

  const fullscreenHook = useFullscreen<Note>("note", {
    allItems: allNotes,
    onDeleteItem: onDeleteNote,
    onUpdateItem: onUpdateNote,
    onUpdateItemColor: onUpdateNoteColor,
    onUpdateItemSharing: onUpdateNoteSharing,
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
    handleFullscreenUpdateSharing: fullscreenHook.handleFullscreenUpdateSharing,
  }
}
