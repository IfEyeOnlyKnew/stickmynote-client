"use client"

import { useRef, useCallback, useEffect, useState } from "react"

interface PullToRefreshOptions {
  /** Distance to pull before triggering refresh (default: 80) */
  threshold?: number
  /** Callback when pull-to-refresh triggers */
  onRefresh: () => Promise<void>
  /** Only enable on touch devices */
  touchOnly?: boolean
}

export function usePullToRefresh<T extends HTMLElement = HTMLElement>(options: PullToRefreshOptions) {
  const { threshold = 80, onRefresh, touchOnly = true } = options
  const ref = useRef<T>(null)
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = ref.current
    if (!el || el.scrollTop > 0) return
    startY.current = e.touches[0].clientY
    setPulling(true)
  }, [])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling || refreshing) return
      currentY.current = e.touches[0].clientY
      const distance = Math.max(0, currentY.current - startY.current)
      // Apply resistance for natural feel
      const resistedDistance = Math.min(distance * 0.5, threshold * 1.5)
      setPullDistance(resistedDistance)
    },
    [pulling, refreshing, threshold],
  )

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return
    setPulling(false)

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    }
    setPullDistance(0)
  }, [pulling, pullDistance, threshold, refreshing, onRefresh])

  useEffect(() => {
    if (touchOnly && !("ontouchstart" in window)) return

    const el = ref.current
    if (!el) return

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: true })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, touchOnly])

  return {
    ref,
    pulling,
    pullDistance,
    refreshing,
    pullProgress: Math.min(pullDistance / threshold, 1),
  }
}
