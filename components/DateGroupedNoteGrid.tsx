"use client"

import React, { useEffect, useMemo, useRef } from "react"
import { NotePreviewCard } from "./NotePreviewCard"
import type { Note } from "@/types/note"
import { Loader2, Calendar } from "lucide-react"
import { groupByDate } from "@/lib/date-grouping"

interface DateGroupedNoteGridProps {
  readonly notes: Note[]
  readonly onNoteClick: (noteId: string) => void
  readonly onUpdateColor?: (noteId: string, color: string) => void
  readonly onLoadMore?: () => Promise<void>
  readonly hasMore?: boolean
  readonly isLoadingMore?: boolean
  readonly loadingNoteId?: string | null
  readonly subStickCountsByParent?: Map<string, number>
  readonly isShowingSubSticks?: boolean
  readonly onCreateSubStick?: (parentNote: Note) => void
  readonly onToggleShowSubSticks?: () => void
}

export const DateGroupedNoteGrid: React.FC<DateGroupedNoteGridProps> = ({
  notes,
  onNoteClick,
  onUpdateColor,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  loadingNoteId = null,
  subStickCountsByParent,
  isShowingSubSticks = false,
  onCreateSubStick,
  onToggleShowSubSticks,
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!onLoadMore || !hasMore) return

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry.isIntersecting && !isLoadingMore && hasMore) {
        onLoadMore()
      }
    }

    observerRef.current = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    })

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => observerRef.current?.disconnect()
  }, [onLoadMore, hasMore, isLoadingMore])

  const groups = useMemo(
    () => groupByDate(notes, (n) => n.updated_at || n.created_at),
    [notes],
  )

  if (notes.length === 0) return null

  return (
    <div className="w-full space-y-6">
      {groups.map((group) => (
        <section key={group.dateKey}>
          <div className="sticky top-[73px] z-30 -mx-2 md:-mx-6 px-2 md:px-6 py-2 bg-gray-50/90 backdrop-blur-sm border-b mb-3">
            <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {group.label}
              <span className="text-xs font-normal text-gray-500">
                ({group.items.length} stick{group.items.length === 1 ? "" : "s"})
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {group.items.map((note) => {
              const isSubStick = Boolean(note.parent_stick_id)
              const hasSubSticks = !isSubStick && (subStickCountsByParent?.get(note.id) ?? 0) > 0
              return (
                <NotePreviewCard
                  key={note.id}
                  note={note}
                  onClick={() => onNoteClick(note.id)}
                  onUpdateColor={onUpdateColor}
                  isLoading={loadingNoteId === note.id}
                  isSubStick={isSubStick}
                  hasSubSticks={hasSubSticks}
                  isShowingSubSticks={isShowingSubSticks}
                  onCreateSubStick={onCreateSubStick && !isSubStick ? () => onCreateSubStick(note) : undefined}
                  onToggleShowSubSticks={onToggleShowSubSticks}
                />
              )
            })}
          </div>
        </section>
      ))}

      <div ref={loadMoreRef} className="flex justify-center py-8">
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading more notes...</span>
          </div>
        )}
        {!isLoadingMore && hasMore && (
          <div className="text-gray-400 text-sm">Scroll for more</div>
        )}
      </div>
    </div>
  )
}
