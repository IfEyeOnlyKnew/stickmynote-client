"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

export interface AccessibilityPreferences {
  /** Font size multiplier: 0.85 | 1 | 1.15 | 1.3 | 1.5 */
  fontSize: number
  /** Enable high contrast mode */
  highContrast: boolean
  /** Reduce motion/animations */
  reduceMotion: boolean
  /** Show enhanced focus indicators */
  enhancedFocus: boolean
  /** Underline all links */
  underlineLinks: boolean
  /** Increase line spacing */
  largeLineHeight: boolean
}

const defaultPreferences: AccessibilityPreferences = {
  fontSize: 1,
  highContrast: false,
  reduceMotion: false,
  enhancedFocus: false,
  underlineLinks: false,
  largeLineHeight: false,
}

interface AccessibilityContextType {
  preferences: AccessibilityPreferences
  updatePreference: <K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K],
  ) => void
  resetPreferences: () => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

const STORAGE_KEY = "stickmynote-accessibility"

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferences({ ...defaultPreferences, ...parsed })
      }
    } catch {
      // Invalid stored data — use defaults
    }
    setMounted(true)
  }, [])

  // Apply preferences to the document
  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement

    // Font size
    root.style.setProperty("--a11y-font-scale", String(preferences.fontSize))
    root.style.fontSize = `${preferences.fontSize * 100}%`

    // High contrast
    root.classList.toggle("high-contrast", preferences.highContrast)

    // Reduced motion
    root.classList.toggle("reduce-motion", preferences.reduceMotion)

    // Enhanced focus
    root.classList.toggle("enhanced-focus", preferences.enhancedFocus)

    // Underline links
    root.classList.toggle("underline-links", preferences.underlineLinks)

    // Large line height
    root.classList.toggle("large-line-height", preferences.largeLineHeight)
  }, [preferences, mounted])

  // Respect OS-level prefers-reduced-motion as default
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches && !localStorage.getItem(STORAGE_KEY)) {
      setPreferences((prev) => ({ ...prev, reduceMotion: true }))
    }
  }, [])

  const updatePreference = useCallback(
    <K extends keyof AccessibilityPreferences>(key: K, value: AccessibilityPreferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // localStorage full or blocked
        }
        return next
      })
    },
    [],
  )

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore
    }
    document.documentElement.style.fontSize = "100%"
  }, [])

  return (
    <AccessibilityContext.Provider value={{ preferences, updatePreference, resetPreferences }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider")
  }
  return context
}
