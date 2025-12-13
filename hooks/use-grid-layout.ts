"use client"

import type React from "react"

import { useMemo } from "react"

interface UseGridLayoutProps {
  windowWidth: number
  fixedItemWidth?: number
  gap?: number
  containerPadding?: number
}

interface UseGridLayoutReturn {
  columnCount: number
  itemWidth: number
  gridStyles: React.CSSProperties
}

export function useGridLayout({
  windowWidth,
  fixedItemWidth = 558,
  gap = 24,
  containerPadding = 48,
}: UseGridLayoutProps): UseGridLayoutReturn {
  const { columnCount, itemWidth } = useMemo(() => {
    // On mobile (<768px), use full width minus padding
    // On tablet/desktop, use fixed width
    let responsiveItemWidth = fixedItemWidth
    let responsivePadding = containerPadding

    if (windowWidth < 768) {
      // Mobile: reduce padding and use full width
      responsivePadding = 16
      responsiveItemWidth = Math.min(windowWidth - responsivePadding * 2, fixedItemWidth)
    } else if (windowWidth < 1024) {
      // Tablet: slightly reduced padding
      responsivePadding = 24
      responsiveItemWidth = Math.min(windowWidth - responsivePadding * 2, fixedItemWidth)
    }

    const availableWidth = windowWidth - responsivePadding
    let cols = Math.max(1, Math.floor((availableWidth + gap) / (responsiveItemWidth + gap)))

    // Responsive column limits based on screen size
    if (windowWidth >= 1200) {
      cols = Math.min(cols, 3) // Max 3 columns on large screens
    } else if (windowWidth >= 768) {
      cols = Math.min(cols, 2) // Max 2 columns on medium screens
    } else {
      cols = 1 // Single column on small screens
    }

    return {
      columnCount: cols,
      itemWidth: responsiveItemWidth,
    }
  }, [windowWidth, fixedItemWidth, gap, containerPadding])

  const gridStyles = useMemo(
    (): React.CSSProperties => ({
      display: "grid",
      gridTemplateColumns: `repeat(${columnCount}, ${itemWidth}px)`,
      gap: `${gap}px`,
      justifyContent: "center",
      width: "100%",
      maxWidth: "none",
    }),
    [columnCount, itemWidth, gap],
  )

  return {
    columnCount,
    itemWidth,
    gridStyles,
  }
}
