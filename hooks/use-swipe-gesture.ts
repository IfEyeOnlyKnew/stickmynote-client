"use client"

import { useRef, useCallback, useEffect } from "react"

interface SwipeOptions {
  /** Minimum distance in pixels to trigger a swipe (default: 50) */
  threshold?: number
  /** Maximum time in ms for a swipe gesture (default: 300) */
  timeout?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

interface TouchData {
  startX: number
  startY: number
  startTime: number
}

export function useSwipeGesture<T extends HTMLElement = HTMLElement>(options: SwipeOptions) {
  const { threshold = 50, timeout = 300, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown } = options
  const ref = useRef<T>(null)
  const touchData = useRef<TouchData | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    touchData.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    }
  }, [])

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchData.current) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchData.current.startX
      const deltaY = touch.clientY - touchData.current.startY
      const elapsed = Date.now() - touchData.current.startTime

      touchData.current = null

      if (elapsed > timeout) return

      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)

      // Determine if horizontal or vertical swipe
      if (absDeltaX > absDeltaY && absDeltaX > threshold) {
        if (deltaX > 0) {
          onSwipeRight?.()
        } else {
          onSwipeLeft?.()
        }
      } else if (absDeltaY > absDeltaX && absDeltaY > threshold) {
        if (deltaY > 0) {
          onSwipeDown?.()
        } else {
          onSwipeUp?.()
        }
      }
    },
    [threshold, timeout, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown],
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchEnd])

  return ref
}
