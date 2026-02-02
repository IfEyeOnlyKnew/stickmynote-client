"use client"

import { useEffect, useState, useCallback } from "react"
import type { CommunicationAction, CommunicationContext } from "@/types/meeting"

/**
 * Hook for managing the Communication Palette state
 * Triggered by Cmd/Ctrl+Shift+J keyboard shortcut
 */
export function useCommunicationPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<CommunicationAction | null>(null)
  const [context, setContext] = useState<CommunicationContext>({})

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const activeElement = document.activeElement
      const isEditing =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement)?.isContentEditable

      // Cmd/Ctrl + Shift + J to toggle palette (avoids browser download shortcut)
      if (e.key === "j" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        // Don't open if user is actively editing, but allow closing
        if (isEditing && !isOpen) {
          return
        }
        setIsOpen((open) => !open)
      }

      // Escape to close palette or modal
      if (e.key === "Escape") {
        if (activeModal) {
          setActiveModal(null)
        } else if (isOpen) {
          setIsOpen(false)
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, activeModal])

  // Close palette when a modal is opened
  const openModal = useCallback((modal: CommunicationAction) => {
    setIsOpen(false)
    setActiveModal(modal)
  }, [])

  // Close modal
  const closeModal = useCallback(() => {
    setActiveModal(null)
  }, [])

  // Update context (called by pages to provide pad/stick info)
  const updateContext = useCallback((newContext: Partial<CommunicationContext>) => {
    setContext((prev) => ({ ...prev, ...newContext }))
  }, [])

  // Clear context (called when leaving a page)
  const clearContext = useCallback(() => {
    setContext({})
  }, [])

  return {
    // Palette state
    isOpen,
    setIsOpen,
    // Modal state
    activeModal,
    setActiveModal,
    openModal,
    closeModal,
    // Context
    context,
    setContext,
    updateContext,
    clearContext,
  }
}

/**
 * Standalone hook for just the Cmd+Shift+J shortcut
 * Use this if you only need the shortcut without full context management
 */
export function useCommunicationShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const activeElement = document.activeElement
      const isEditing =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement)?.isContentEditable

      if (isEditing) {
        return
      }

      // Cmd/Ctrl + Shift + J to open (avoids browser download shortcut)
      if (e.key === "j" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        onOpen()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onOpen])
}
