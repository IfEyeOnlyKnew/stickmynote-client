"use client"

import { RefreshCw } from "lucide-react"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { cn } from "@/lib/utils"

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  className?: string
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const { ref, pullDistance, refreshing, pullProgress } = usePullToRefresh<HTMLDivElement>({
    onRefresh,
    threshold: 80,
  })

  return (
    <div ref={ref} className={cn("relative overflow-auto", className)}>
      {/* Pull indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-opacity pointer-events-none z-10"
        style={{
          top: Math.max(0, pullDistance - 40),
          opacity: pullProgress,
        }}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-background border shadow-sm",
            refreshing && "animate-spin",
          )}
        >
          <RefreshCw
            className="h-5 w-5 text-muted-foreground"
            style={{
              transform: refreshing ? undefined : `rotate(${pullProgress * 360}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: pullDistance === 0 ? "transform 0.3s ease" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
