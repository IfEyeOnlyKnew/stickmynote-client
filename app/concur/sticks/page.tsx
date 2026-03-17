"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Loader2,
  MessageCircle,
  Pin,
  Calendar,
  Eye,
} from "lucide-react"
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns"
import { ConcurStickDetailModal } from "@/components/concur/concur-stick-detail-modal"

// ============================================================================
// Types
// ============================================================================

interface FeedStick {
  id: string
  group_id: string
  group_name: string
  group_logo_url: string | null
  group_header_image_url: string | null
  topic: string | null
  content: string
  color: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  reply_count: number
  view_count: number
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
// Helpers
// ============================================================================

function getDateKey(dateStr: string): string {
  const date = new Date(dateStr)
  // Use local date as the key (YYYY-MM-DD)
  return format(date, "yyyy-MM-dd")
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "EEEE, MMMM d, yyyy")
}

interface DateGroup {
  dateKey: string
  label: string
  sticks: FeedStick[]
}

function groupSticksByDate(sticks: FeedStick[]): DateGroup[] {
  const groups: DateGroup[] = []
  const map = new Map<string, DateGroup>()

  for (const stick of sticks) {
    const key = getDateKey(stick.created_at)
    if (!map.has(key)) {
      const group: DateGroup = {
        dateKey: key,
        label: getDateLabel(stick.created_at),
        sticks: [],
      }
      map.set(key, group)
      groups.push(group)
    }
    map.get(key)!.sticks.push(stick)
  }

  return groups
}

// ============================================================================
// Page
// ============================================================================

export default function ConcurSticksPage() {
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

  // Group sticks by date for rendering
  const dateGroups = useMemo(() => groupSticksByDate(sticks), [sticks])

  const handleSelectStick = (stick: FeedStick) => {
    setSelectedStick(stick)
    // Record view (fire-and-forget)
    fetch(`/api/concur/groups/${stick.group_id}/sticks/${stick.id}/view`, {
      method: "POST",
    }).catch(() => {})
  }

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
            <div className="space-y-6">
              {dateGroups.map((group) => (
                <section key={group.dateKey}>
                  {/* Sticky date header */}
                  <div className="sticky top-[73px] z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-slate-50/90 backdrop-blur-sm border-b">
                    <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {group.label}
                      <span className="text-xs font-normal">
                        ({group.sticks.length} stick{group.sticks.length !== 1 ? "s" : ""})
                      </span>
                    </h2>
                  </div>

                  {/* Sticks grid for this date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3">
                    {group.sticks.map((stick) => (
                      <FeedStickCard
                        key={stick.id}
                        stick={stick}
                        onClick={() => handleSelectStick(stick)}
                      />
                    ))}
                  </div>
                </section>
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
          groupName={selectedStick.group_name}
          groupLogoUrl={selectedStick.group_logo_url}
          groupHeaderImageUrl={selectedStick.group_header_image_url}
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
      className="cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all duration-200 overflow-hidden"
      onClick={onClick}
    >
      {/* Header image with logo + group name overlay */}
      {stick.group_header_image_url ? (
        <div className="relative h-28">
          <img
            src={stick.group_header_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5">
            {stick.group_logo_url && (
              <img
                src={stick.group_logo_url}
                alt=""
                className="h-6 w-6 rounded object-cover border border-white/30 shadow-sm"
              />
            )}
            <span className="text-xs font-semibold text-white drop-shadow-sm truncate max-w-[180px]">
              {stick.group_name}
            </span>
          </div>
          {stick.is_pinned && (
            <div className="absolute top-2 right-2">
              <Pin className="h-3.5 w-3.5 text-white drop-shadow-sm" />
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4 flex items-center justify-between">
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full truncate max-w-[200px] flex items-center gap-1">
            {stick.group_logo_url && (
              <img
                src={stick.group_logo_url}
                alt=""
                className="h-4 w-4 rounded object-cover inline-block"
              />
            )}
            {stick.group_name}
          </span>
          {stick.is_pinned && <Pin className="h-3 w-3 text-indigo-500 shrink-0" />}
        </div>
      )}

      <CardContent className="p-4">
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
              <Eye className="h-3 w-3" />
              {stick.view_count}
            </span>
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
