"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Loader2,
  MessageCircle,
  Pin,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ConcurStickDetailModal } from "@/components/concur/concur-stick-detail-modal"

// ============================================================================
// Types
// ============================================================================

interface FeedStick {
  id: string
  group_id: string
  group_name: string
  topic: string | null
  content: string
  color: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  reply_count: number
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 12

// ============================================================================
// Page
// ============================================================================

export default function ConcurSticksPage() {
  const router = useRouter()
  const [sticks, setSticks] = useState<FeedStick[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [selectedStick, setSelectedStick] = useState<FeedStick | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchSticks = useCallback(async (cursor?: string | null) => {
    const isInitial = !cursor
    if (isInitial) setLoading(true)
    else setLoadingMore(true)

    try {
      const url = new URL("/api/concur/sticks", window.location.origin)
      url.searchParams.set("limit", String(PAGE_SIZE))
      if (cursor) url.searchParams.set("cursor", cursor)

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()

      if (isInitial) {
        setSticks(data.sticks || [])
      } else {
        setSticks((prev) => [...prev, ...(data.sticks || [])])
      }
      setNextCursor(data.nextCursor || null)
      setHasMore(data.hasMore || false)
    } catch (error) {
      console.error("Failed to fetch concur sticks feed:", error)
    } finally {
      if (isInitial) setLoading(false)
      else setLoadingMore(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchSticks()
  }, [fetchSticks])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && nextCursor) {
          fetchSticks(nextCursor)
        }
      },
      { threshold: 0.1 }
    )

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [hasMore, loadingMore, nextCursor, fetchSticks])

  const handleStickUpdated = () => {
    // Refresh from the beginning to get updated data
    fetchSticks()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <BreadcrumbNav
                items={[
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "Concur Sticks" },
                ]}
              />
              <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
                <MessageCircle className="h-6 w-6 text-indigo-600" />
                Concur Sticks
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Latest posts from your groups
              </p>
            </div>
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : sticks.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold text-muted-foreground">No Sticks Yet</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Posts from your Concur groups will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sticks.map((stick) => (
                <FeedStickCard
                  key={stick.id}
                  stick={stick}
                  onClick={() => setSelectedStick(stick)}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
              {loadingMore && (
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              )}
              {!hasMore && sticks.length > 0 && (
                <p className="text-sm text-muted-foreground">No more sticks</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Stick Detail Modal */}
      {selectedStick && (
        <ConcurStickDetailModal
          groupId={selectedStick.group_id}
          stick={{
            ...selectedStick,
            user_id: selectedStick.user?.id || "",
          }}
          isOwner={false}
          onClose={() => setSelectedStick(null)}
          onStickUpdated={handleStickUpdated}
        />
      )}
    </div>
  )
}

// ============================================================================
// Feed Stick Card
// ============================================================================

function FeedStickCard({ stick, onClick }: { stick: FeedStick; onClick: () => void }) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all duration-200"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Group badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full truncate max-w-[200px]">
            {stick.group_name}
          </span>
          {stick.is_pinned && <Pin className="h-3 w-3 text-indigo-500 shrink-0" />}
        </div>

        {/* Topic & content */}
        <div className="min-w-0">
          {stick.topic && (
            <h3 className="font-semibold text-sm truncate">{stick.topic}</h3>
          )}
          <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
            {stick.content}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={stick.user?.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {stick.user?.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {stick.user?.full_name || "Unknown"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {stick.reply_count}
            </span>
            <span>{formatDistanceToNow(new Date(stick.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
