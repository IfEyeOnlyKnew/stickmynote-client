"use client"

import { useState } from "react"
import { toast } from "@/hooks/use-toast"
import type { NoteTabsConfig } from "@/types/note-tabs-config"

interface MediaItem {
  id: string
  url: string
  [key: string]: any
}

interface UseMediaUploadBaseProps {
  noteId: string
  config: NoteTabsConfig
  onTabsUpdate: (tabs: any[]) => void
  onTabChange?: (tab: string) => void
  tabType: "videos" | "images"
  tabName: string
}

interface UseMediaUploadBaseReturn<T extends MediaItem> {
  // Common state
  url: string
  setUrl: (url: string) => void
  isLoading: boolean

  // Common operations
  handleAdd: (existingItems: T[], newItem: T) => Promise<void>
  handleDelete: (itemId: string) => Promise<void>

  // Validation helpers
  validateUrl: (url: string) => boolean
  showError: (title: string, description: string) => void
  showSuccess: (title: string, description: string) => void
}

export function useMediaUploadBase<T extends MediaItem>({
  noteId,
  config,
  onTabsUpdate,
  onTabChange,
  tabType,
  tabName,
}: UseMediaUploadBaseProps): UseMediaUploadBaseReturn<T> {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const validateUrl = (urlToValidate: string): boolean => {
    if (!urlToValidate.trim()) return false

    try {
      new URL(urlToValidate)
      return true
    } catch {
      return false
    }
  }

  const showError = (title: string, description: string) => {
    toast({
      title,
      description,
      variant: "destructive",
    })
  }

  const showSuccess = (title: string, description: string) => {
    toast({
      title,
      description,
    })
  }

  const handleAdd = async (existingItems: T[], newItem: T): Promise<void> => {
    if (isLoading) return

    setIsLoading(true)
    try {
      // Check if item already exists
      const itemExists = existingItems.some((item) => item.id === newItem.id || item.url === newItem.url)
      if (itemExists) {
        showError("Duplicate Item", `This ${tabName.toLowerCase().slice(0, -1)} already exists.`)
        return
      }

      const updatedItems = [...existingItems, newItem]

      console.log("[v0] Saving note tab:", { noteId, tabType, itemCount: updatedItems.length })

      await config.saveNoteTab(noteId, tabType, { [tabType]: updatedItems })

      await new Promise((resolve) => setTimeout(resolve, 500))

      try {
        const updatedTabs = await config.getNoteTabs(noteId)
        console.log("[v0] Refreshed note tabs:", updatedTabs.length)
        onTabsUpdate(updatedTabs)
      } catch (refreshError) {
        console.warn("[v0] Failed to refresh note tabs, but save was successful:", refreshError)
      }

      setUrl("")

      // Clear file input if it exists
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ""

      onTabChange?.(tabName)

      showSuccess(
        `${tabName.slice(0, -1)} added`,
        `${tabName.slice(0, -1)} saved to this ${config.isTeamNote ? "team " : ""}note.`,
      )
    } catch (error) {
      console.error("[v0] Error adding media item:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      showError("Save Failed", `Failed to add ${tabName.toLowerCase().slice(0, -1)}: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (itemId: string): Promise<void> => {
    if (!globalThis.confirm(`Delete this ${tabName.toLowerCase().slice(0, -1)}?`)) return

    try {
      console.log("[v0] Deleting media item:", { noteId, tabType, itemId })

      await config.deleteNoteTabItem(noteId, tabType, itemId)

      await new Promise((resolve) => setTimeout(resolve, 500))

      console.log("[v0] Refreshing note tabs after delete...")
      const updatedTabs = await config.getNoteTabs(noteId)
      console.log("[v0] Updated note tabs received:", updatedTabs.length)
      onTabsUpdate(updatedTabs)

      onTabChange?.(tabName)
      showSuccess(`${tabName.slice(0, -1)} deleted`, "Item successfully removed.")
    } catch (error) {
      console.error("[v0] Error deleting media item:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      showError("Delete Failed", `Failed to delete ${tabName.toLowerCase().slice(0, -1)}: ${errorMessage}`)
    }
  }

  return {
    url,
    setUrl,
    isLoading,
    handleAdd,
    handleDelete,
    validateUrl,
    showError,
    showSuccess,
  }
}
