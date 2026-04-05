"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react"
import type { CommunicationAction, CommunicationContext } from "@/types/meeting"

// ----------------------------------------------------------------------------
// Context Types
// ----------------------------------------------------------------------------

interface CommunicationPaletteContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void
  activeModal: CommunicationAction | null
  openModal: (modal: CommunicationAction) => void
  closeModal: () => void
  context: CommunicationContext
  updateContext: (newContext: Partial<CommunicationContext>) => void
  clearContext: () => void
}

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

const CommunicationPaletteContext = createContext<CommunicationPaletteContextValue | null>(null)

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

interface CommunicationPaletteProviderProps {
  children: ReactNode
  padId?: string
  padName?: string
  stickId?: string
  stickTopic?: string
}

export function CommunicationPaletteProvider({
  children,
  padId,
  padName,
  stickId,
  stickTopic,
}: Readonly<CommunicationPaletteProviderProps>) {
  // State
  const [isOpen, setIsOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<CommunicationAction | null>(null)

  // Context is initialized once and stored in state
  const [context] = useState<CommunicationContext>(() => {
    const ctx: CommunicationContext = {}
    if (padId) ctx.padId = padId
    if (padName) ctx.padName = padName
    if (stickId) ctx.stickId = stickId
    if (stickTopic) ctx.stickTopic = stickTopic
    return ctx
  })

  // Refs for keyboard handler
  const stateRef = useRef({ isOpen, activeModal })
  useEffect(() => {
    stateRef.current = { isOpen, activeModal }
  })

  // Stable callbacks - these never change
  const openPalette = useCallback(() => setIsOpen(true), [])
  const closePalette = useCallback(() => setIsOpen(false), [])
  const togglePalette = useCallback(() => setIsOpen(prev => !prev), [])
  const openModal = useCallback((modal: CommunicationAction) => {
    setIsOpen(false)
    setActiveModal(modal)
  }, [])
  const closeModal = useCallback(() => setActiveModal(null), [])
  const updateContext = useCallback(() => {}, [])
  const clearContext = useCallback(() => {}, [])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement
      const isEditing = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || (active as HTMLElement)?.isContentEditable

      if (e.key === "j" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        if (isEditing && !stateRef.current.isOpen) return
        setIsOpen(prev => !prev)
      }
      if (e.key === "Escape") {
        if (stateRef.current.activeModal) {
          e.preventDefault()
          setActiveModal(null)
        } else if (stateRef.current.isOpen) {
          e.preventDefault()
          setIsOpen(false)
        }
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  // Memoize value - only changes when state actually changes
  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      openPalette,
      closePalette,
      togglePalette,
      activeModal,
      openModal,
      closeModal,
      context,
      updateContext,
      clearContext,
    }),
    [isOpen, activeModal, context, openPalette, closePalette, togglePalette, openModal, closeModal, updateContext, clearContext]
  )

  return (
    <CommunicationPaletteContext.Provider value={value}>
      {children}
    </CommunicationPaletteContext.Provider>
  )
}

// ----------------------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------------------

export function useCommunicationPaletteContext() {
  const context = useContext(CommunicationPaletteContext)
  if (!context) {
    throw new Error("useCommunicationPaletteContext must be used within a CommunicationPaletteProvider")
  }
  return context
}

export function useCommunicationPaletteContextSafe() {
  return useContext(CommunicationPaletteContext)
}
