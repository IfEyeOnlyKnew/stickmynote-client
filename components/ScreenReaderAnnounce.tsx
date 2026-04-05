"use client"

import { useState, useCallback, useMemo, createContext, useContext, type ReactNode } from "react"

interface AnnounceContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void
}

const AnnounceContext = createContext<AnnounceContextType | undefined>(undefined)

export function ScreenReaderAnnounceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [politeMessage, setPoliteMessage] = useState("")
  const [assertiveMessage, setAssertiveMessage] = useState("")

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    if (priority === "assertive") {
      setAssertiveMessage("")
      // Small delay to ensure screen readers pick up the change
      requestAnimationFrame(() => setAssertiveMessage(message))
    } else {
      setPoliteMessage("")
      requestAnimationFrame(() => setPoliteMessage(message))
    }
  }, [])

  const contextValue = useMemo(() => ({ announce }), [announce])

  return (
    <AnnounceContext.Provider value={contextValue}>
      {children}
      {/* Polite announcements (queued, non-interrupting) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {politeMessage}
      </div>
      {/* Assertive announcements (immediate, interrupting) */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnounceContext.Provider>
  )
}

export function useAnnounce(): AnnounceContextType {
  const context = useContext(AnnounceContext)
  if (!context) {
    throw new Error("useAnnounce must be used within a ScreenReaderAnnounceProvider")
  }
  return context
}
