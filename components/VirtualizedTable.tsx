"use client"

import type React from "react"

import { useRef, useEffect, useState, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface VirtualizedTableProps<T> {
  data: T[]
  renderRow: (item: T, index: number) => React.ReactNode
  renderHeader: () => React.ReactNode
  itemHeight?: number
  overscan?: number
  onLoadMore?: () => Promise<void>
  hasMore?: boolean
  isLoadingMore?: boolean
  emptyState?: React.ReactNode
  className?: string
}

export function VirtualizedTable<T extends { id: string }>({
  data,
  renderRow,
  renderHeader,
  itemHeight = 60,
  overscan = 5,
  onLoadMore,
  hasMore,
  isLoadingMore,
  emptyState,
  className = "",
}: VirtualizedTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 })

  // Setup IntersectionObserver for infinite loading
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !onLoadMore || !hasMore) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore()
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0.1,
      },
    )

    observerRef.current.observe(loadMoreTriggerRef.current)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [onLoadMore, hasMore, isLoadingMore])

  // Handle scroll-based virtualization
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const scrollTop = containerRef.current.scrollTop
    const viewportHeight = containerRef.current.clientHeight

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(data.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan)

    setVisibleRange({ start, end })
  }, [data.length, itemHeight, overscan])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("scroll", handleScroll)
    handleScroll() // Initial calculation

    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  if (data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>
  }

  const visibleData = data.slice(visibleRange.start, visibleRange.end)
  const offsetY = visibleRange.start * itemHeight
  const totalHeight = data.length * itemHeight

  return (
    <div ref={containerRef} className={`overflow-auto ${className}`}>
      <table className="w-full">
        <thead className="sticky top-0 bg-white z-10 border-b">{renderHeader()}</thead>
        <tbody style={{ height: totalHeight, position: "relative" }}>
          <tr style={{ height: offsetY }} />
          {visibleData.map((item, index) => renderRow(item, visibleRange.start + index))}
        </tbody>
      </table>

      {/* Infinite-scroll sentinel */}
      {hasMore && onLoadMore && <div ref={loadMoreTriggerRef} className="h-4 w-full" />}

      {/* Loading indicator */}
      {isLoadingMore && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
        </div>
      )}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12" />
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-12 w-24" />
        </div>
      ))}
    </div>
  )
}
