"use client"

import React, { useEffect, useRef, useCallback } from "react"
import { NotePreviewCard } from "./NotePreviewCard"
import type { Note } from "@/types/note"
import { Loader2 } from "lucide-react"

interface SimpleNoteGridProps {
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

export const SimpleNoteGrid: React.FC<SimpleNoteGridProps> = ({
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

  // Infinite scroll with IntersectionObserver
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

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [onLoadMore, hasMore, isLoadingMore])

  const handleNoteClick = useCallback(
    (noteId: string) => {
      onNoteClick(noteId)
    },
    [onNoteClick]
  )

  if (notes.length === 0) {
    return null
  }

  return (
    <div className="w-full">
      {/* Responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {notes.map((note) => {
          const isSubStick = Boolean(note.parent_stick_id)
          const hasSubSticks = !isSubStick && (subStickCountsByParent?.get(note.id) ?? 0) > 0
          return (
            <NotePreviewCard
              key={note.id}
              note={note}
              onClick={() => handleNoteClick(note.id)}
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

      {/* Load more trigger / loading indicator */}
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
