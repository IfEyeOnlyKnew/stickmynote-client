"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export type ShortcutAction = {
  key: string
  label: string
  description: string
  handler: (e?: KeyboardEvent) => void
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export function useKeyboardShortcuts(actions: ShortcutAction[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = actions.find((a) => {
        const keyMatch = a.key.toLowerCase() === event.key.toLowerCase()
        const ctrlMatch = a.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
        const shiftMatch = a.shift ? event.shiftKey : !event.shiftKey
        const altMatch = a.alt ? event.altKey : !event.altKey

        return keyMatch && ctrlMatch && shiftMatch && altMatch
      })

      if (action) {
        event.preventDefault()
        action.handler(event)
      }
    }

    globalThis.addEventListener("keydown", handleKeyDown)
    return () => globalThis.removeEventListener("keydown", handleKeyDown)
  }, [actions])
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return { isOpen, setIsOpen, router }
}
