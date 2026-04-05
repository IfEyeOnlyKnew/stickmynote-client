"use client"

import { useEffect } from "react"

/**
 * Detects whether the user is navigating with keyboard or mouse.
 * Adds/removes `using-keyboard` class on <body> to enable
 * keyboard-specific focus styles.
 */
export function KeyboardDetector() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        document.body.classList.add("using-keyboard")
      }
    }

    const handleMouseDown = () => {
      document.body.classList.remove("using-keyboard")
    }

    globalThis.addEventListener("keydown", handleKeyDown)
    globalThis.addEventListener("mousedown", handleMouseDown)

    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown)
      globalThis.removeEventListener("mousedown", handleMouseDown)
    }
  }, [])

  return null
}
