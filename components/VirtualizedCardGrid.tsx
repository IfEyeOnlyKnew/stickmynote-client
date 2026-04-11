"use client"

import type React from "react"

import { useRef, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface VirtualizedCardGridProps<T> {
  data: T[]
  renderCard: (item: T, index: number) => React.ReactNode
  onLoadMore?: () => Promise<void>
  hasMore?: boolean
  isLoadingMore?: boolean
  emptyState?: React.ReactNode
  className?: string
  columns?: {
    default: number
    md?: number
    lg?: number
  }
}

export function VirtualizedCardGrid<T extends { id: string }>({
  data,
  renderCard,
  onLoadMore,
  hasMore,
  isLoadingMore,
  emptyState,
  className = "",
  columns = { default: 1, md: 2, lg: 3 },
}: Readonly<VirtualizedCardGridProps<T>>) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)

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

  if (data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>
  }

  const gridCols = "grid-cols-" + columns.default + (columns.md ? " md:grid-cols-" + columns.md : "") + (columns.lg ? " lg:grid-cols-" + columns.lg : "")

  return (
    <div className={className}>
      <div className={`grid ${gridCols} gap-6`}>{data.map((item, index) => renderCard(item, index))}</div>

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

export function CardGridSkeleton({
  count = 6,
  columns = { default: 1, md: 2, lg: 3 },
}: Readonly<{ count?: number; columns?: { default: number; md?: number; lg?: number } }>) {
  const gridCols = "grid-cols-" + columns.default + (columns.md ? " md:grid-cols-" + columns.md : "") + (columns.lg ? " lg:grid-cols-" + columns.lg : "")

  return (
    <div className={`grid ${gridCols} gap-6`}>
      {Array.from({ length: count }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
        <Card key={`skeleton-${i}`}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
