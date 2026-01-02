"use client"

import { useState, useCallback, useEffect, useRef } from "react"

export interface FullscreenItem {
  id: string
  topic?: string
  content?: string
  color?: string
  user_id?: string
  created_at?: string
  [key: string]: any // Allows any additional properties
}

interface UseFullscreenProps<T extends FullscreenItem> {
  allItems?: T[]
  onDeleteItem?: (itemId: string) => void
  onUpdateItem?: (itemId: string, updates: Partial<T>) => Promise<void>
  onUpdateItemColor?: (id: string, color: string) => Promise<void>
  onUpdateItemSharing?: (id: string, isShared: boolean) => Promise<void>
}

interface UseFullscreenReturn<T extends FullscreenItem> {
  // State
  fullscreenItemId: string | null
  fullscreenItem: T | null
  isFullscreen: boolean

  // Actions
  openFullscreen: (itemId: string) => void
  closeFullscreen: () => void
  toggleFullscreen: (itemId: string) => void
  handleFullscreenKeyPress: (event: KeyboardEvent) => void

  // Fullscreen-specific operations
  handleFullscreenDelete: () => void
  handleFullscreenUpdateColor: (color: string) => Promise<void>
  handleFullscreenUpdateItem: (itemId: string, updates: Partial<T>) => Promise<void>
  handleFullscreenUpdateSharing?: (isShared: boolean) => Promise<void>
}

export const useFullscreen = <T extends FullscreenItem>(
  mode: string,
  props: UseFullscreenProps<T> = {},
): UseFullscreenReturn<T> => {
  const { allItems = [], onDeleteItem, onUpdateItem, onUpdateItemColor, onUpdateItemSharing } = props
  const [fullscreenItemId, setFullscreenItemId] = useState<string | null>(null)
  // Track if a deletion was explicitly requested to distinguish from temporary state changes
  const isExplicitDeletionRef = useRef(false)

  // Get the current fullscreen item
  const fullscreenItem = fullscreenItemId ? allItems.find((item) => item.id === fullscreenItemId) || null : null

  const isFullscreen = fullscreenItemId !== null

  // Open fullscreen mode for a specific item
  const openFullscreen = useCallback(
    (itemId: string) => {
      const item = allItems.find((n) => n.id === itemId)

      if (item || itemId.startsWith("temp-")) {
        setFullscreenItemId(itemId)
        document.body.style.overflow = "hidden"
      }
    },
    [allItems],
  )

  // Close fullscreen mode
  const closeFullscreen = useCallback(() => {
    setFullscreenItemId(null)
    isExplicitDeletionRef.current = false
    // Restore body scrolling
    document.body.style.overflow = "unset"
  }, [])

  // Toggle fullscreen mode for an item
  const toggleFullscreen = useCallback(
    (itemId: string) => {
      if (fullscreenItemId === itemId) {
        closeFullscreen()
      } else {
        openFullscreen(itemId)
      }
    },
    [fullscreenItemId, openFullscreen, closeFullscreen],
  )

  // Handle keyboard shortcuts in fullscreen mode
  const handleFullscreenKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!isFullscreen) return

      // ESC key to close fullscreen
      if (event.key === "Escape") {
        event.preventDefault()
        closeFullscreen()
      }

      // F11 or F key to toggle fullscreen (optional)
      if (event.key === "F11" || (event.key === "f" && event.ctrlKey)) {
        event.preventDefault()
        closeFullscreen()
      }
    },
    [isFullscreen, closeFullscreen],
  )

  // Handle delete in fullscreen mode
  const handleFullscreenDelete = useCallback(() => {
    if (fullscreenItem && onDeleteItem) {
      isExplicitDeletionRef.current = true
      onDeleteItem(fullscreenItem.id)
      closeFullscreen()
    }
  }, [fullscreenItem, onDeleteItem, closeFullscreen])

  // Handle color update in fullscreen mode
  const handleFullscreenUpdateColor = useCallback(
    async (color: string) => {
      if (fullscreenItem && onUpdateItemColor) {
        await onUpdateItemColor(fullscreenItem.id, color)
      }
    },
    [fullscreenItem, onUpdateItemColor],
  )

  // Handle item update in fullscreen mode
  const handleFullscreenUpdateItem = useCallback(
    async (itemId: string, updates: Partial<T>) => {
      if (onUpdateItem) {
        await onUpdateItem(itemId, updates)
      }
    },
    [onUpdateItem],
  )

  const handleFullscreenUpdateSharing = useCallback(
    async (isShared: boolean) => {
      if (fullscreenItem && onUpdateItemSharing) {
        await onUpdateItemSharing(fullscreenItem.id, isShared)
      }
    },
    [fullscreenItem, onUpdateItemSharing],
  )

  // Set up keyboard event listeners
  useEffect(() => {
    if (isFullscreen) {
      document.addEventListener("keydown", handleFullscreenKeyPress)
      return () => {
        document.removeEventListener("keydown", handleFullscreenKeyPress)
      }
    }
  }, [isFullscreen, handleFullscreenKeyPress])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Restore body scrolling if component unmounts while in fullscreen
      document.body.style.overflow = "unset"
    }
  }, [])

  // Close fullscreen only if the item was explicitly deleted
  // Don't close during temporary state changes (e.g., tab refresh, data updates)
  useEffect(() => {
    if (fullscreenItemId && !fullscreenItem && isExplicitDeletionRef.current) {
      closeFullscreen()
      isExplicitDeletionRef.current = false
    }
  }, [fullscreenItemId, fullscreenItem, closeFullscreen])

  return {
    // State
    fullscreenItemId,
    fullscreenItem,
    isFullscreen,

    // Actions
    openFullscreen,
    closeFullscreen,
    toggleFullscreen,
    handleFullscreenKeyPress,

    // Fullscreen-specific operations
    handleFullscreenDelete,
    handleFullscreenUpdateColor,
    handleFullscreenUpdateItem,
    ...(onUpdateItemSharing && { handleFullscreenUpdateSharing }),
  }
}
