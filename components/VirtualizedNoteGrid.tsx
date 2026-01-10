"use client";

/**
 * VirtualizedNoteGrid (client component)
 *
 * Purpose
 * - Render a responsive, virtualized-like grid of notes with lazy/infinite loading.
 * - Delegates per-note rendering to <GridNoteItem/> and exposes a rich set of handlers via props.
 *
 * Data flow
 * - Receives an ordered `notes` array and window size.
 * - Uses `IntersectionObserver` to trigger server-side load (onLoadMore) when available.
 * - Falls back to local pagination via `usePagination` when server load isn’t provided.
 *
 * Notable hooks
 * - useGridLayout: computes grid CSS and item width based on viewport.
 * - usePagination: controls client-side page windows when server paging isn’t used.
 * - IntersectionObserver: pre-emptive load more when the sentinel enters viewport.
 */
import type React from "react";
import { useMemo, useRef, useCallback, useEffect } from "react";
import type { Note } from "@/types/note";
import { GridNoteItem } from "./GridNoteItem";
import { Button } from "./ui/button";
import { usePagination } from "@/hooks/use-pagination";
import { useGridLayout } from "@/hooks/use-grid-layout";
import { Loader2 } from "lucide-react";
import type {
  NoteEventHandlers,
  NoteReplyHandlers,
  NoteStateManagement,
  NoteConfiguration,
} from "@/types/note-props";

// Public props accepted by the grid; events and configuration are passed down to each GridNoteItem
interface VirtualizedNoteGridProps {
  notes: Note[];
  windowSize: { width: number; height: number };
  onNoteInteraction?: (noteId: string) => void;
  onMouseDown?: (e: React.MouseEvent, noteId: string) => void;
  draggedNote?: string | null;
  currentUserId?: string;
  onNoteHeightChange?: (noteId: string, height: number) => void;
  onOpenFullscreen?: (noteId: string) => void;
  onAddReply?: (
    noteId: string,
    content: string,
    color?: string,
    parentReplyId?: string | null
  ) => Promise<void>;
  onUpdateSharing?: (noteId: string, isShared: boolean) => void;
  onUpdateColor?: (noteId: string, color: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onTopicChange?: (noteId: string, topic: string) => void;
  onContentChange?: (noteId: string, content: string) => void;
  onDetailsChange?: (noteId: string, details: string) => void;
  onGenerateTags?: (noteId: string, topic: string) => void;
  onSummarizeLinks?: (noteId: string) => void;
  onReplyFormToggle?: (noteId: string, isVisible: boolean) => void;
  hasActiveReplyForm?: (noteId: string) => boolean;
  lastInteractedNote?: string | null;
  onNoteUpdate?: (note: Note) => void;
  readOnly?: boolean;
  hideGenerateTags?: boolean;
  newNoteIds?: Set<string>;
  onCancelNewNote?: (noteId: string) => void;
  onStickNewNote?: (noteId: string) => void;
  focusTopicId?: string | null;
  onFocusTopicTextarea?: (noteId: string) => void;
  generatingTags?: string | null;
  summarizingLinks?: string | null;
  tabsRefreshKeys?: Record<string, number>;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function VirtualizedNoteGrid({
  notes,
  windowSize,
  onLoadMore,
  hasMore,
  isLoadingMore,
  ...props
}: VirtualizedNoteGridProps) {
  // Refs for container and the infinite-scroll sentinel
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const notesPerPage = 20;

  // Local pagination state when server-driven paging is not used
  const {
    loadedPages,
    totalPages,
    hasMorePages,
    displayedItemsCount,
    loadMorePages,
  } = usePagination({
    totalItems: notes.length,
    itemsPerPage: notesPerPage,
    enableInfiniteScroll: false, // We'll handle scroll manually
  });

  // Compute responsive grid sizing (gap/padding shrink on small screens)
  const { itemWidth, gridStyles } = useGridLayout({
    windowWidth: windowSize.width,
    fixedItemWidth: 558,
    gap: windowSize.width < 768 ? 16 : 24, // Smaller gap on mobile
    containerPadding: windowSize.width < 768 ? 16 : 48, // Smaller padding on mobile
  });

  // Determine which notes to render based on loaded page count
  const displayedNotes = useMemo(() => {
    const endIndex = loadedPages * notesPerPage;
    return notes.slice(0, endIndex);
  }, [notes, loadedPages, notesPerPage]);

  // Setup IntersectionObserver for infinite loading when server-side loader is provided
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !onLoadMore || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: "200px", // Trigger 200px before reaching the element
        threshold: 0.1,
      }
    );

    observerRef.current.observe(loadMoreTriggerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onLoadMore, hasMore, isLoadingMore]);

  // Normalize/collect note event handlers for child items
  const eventHandlers = useMemo(
    (): NoteEventHandlers => ({
      onMouseDown: props.onMouseDown,
      onNoteInteraction: props.onNoteInteraction,
      onNoteHeightChange: props.onNoteHeightChange,
      onOpenFullscreen: props.onOpenFullscreen,
      onUpdateSharing: props.onUpdateSharing || (() => {}),
      onUpdateColor: props.onUpdateColor || (() => {}),
      onDeleteNote: props.onDeleteNote || (() => {}),
      onTopicChange: props.onTopicChange || (() => {}),
      onContentChange: props.onContentChange || (() => {}),
      onDetailsChange: props.onDetailsChange || (() => {}),
      onGenerateTags: props.onGenerateTags || (() => {}),
      onSummarizeLinks: props.onSummarizeLinks,
      onNoteUpdate: props.onNoteUpdate,
      onFocusTopicTextarea: props.onFocusTopicTextarea,
    }),
    [
      props.onMouseDown,
      props.onNoteInteraction,
      props.onNoteHeightChange,
      props.onOpenFullscreen,
      props.onUpdateSharing,
      props.onUpdateColor,
      props.onDeleteNote,
      props.onTopicChange,
      props.onContentChange,
      props.onDetailsChange,
      props.onGenerateTags,
      props.onSummarizeLinks,
      props.onNoteUpdate,
      props.onFocusTopicTextarea,
    ]
  );

  // Reply-specific handlers
  const replyHandlers = useMemo(
    (): NoteReplyHandlers => ({
      onAddReply: props.onAddReply
        ? async (noteId: string, content: string, color?: string) => {
            await props.onAddReply!(noteId, content, color);
          }
        : async () => {},
      onReplyFormToggle: props.onReplyFormToggle,
    }),
    [props.onAddReply, props.onReplyFormToggle]
  );

  // Shared state references for each child note
  const stateManagement = useMemo(
    (): NoteStateManagement => ({
      draggedNote: props.draggedNote,
      lastInteractedNote: props.lastInteractedNote,
      hasActiveReplyForm: undefined,
      newNoteIds: props.newNoteIds,
      generatingTags: props.generatingTags,
      summarizingLinks: props.summarizingLinks,
      focusTopicId: props.focusTopicId,
      tabsRefreshKeys: props.tabsRefreshKeys,
    }),
    [
      props.draggedNote,
      props.lastInteractedNote,
      props.newNoteIds,
      props.generatingTags,
      props.summarizingLinks,
      props.focusTopicId,
      props.tabsRefreshKeys,
    ]
  );

  // Per-item configuration that affects rendering/behavior
  const configuration = useMemo(
    (): NoteConfiguration => ({
      mode: "card",
      currentUserId: props.currentUserId,
      readOnly: props.readOnly,
      hideGenerateTags: props.hideGenerateTags,
      onCancelNewNote: props.onCancelNewNote,
      onStickNewNote: props.onStickNewNote,
    }),
    [
      props.currentUserId,
      props.readOnly,
      props.hideGenerateTags,
      props.onCancelNewNote,
      props.onStickNewNote,
    ]
  );

  // Load-more action: prefer server-side onLoadMore, else extend local page window
  const handleLoadMore = useCallback(() => {
    if (onLoadMore && hasMore) {
      onLoadMore();
    } else {
      loadMorePages(5);
    }
  }, [onLoadMore, hasMore, loadMorePages]);

  if (notes.length === 0) {
    return null;
  }

  return (
    <div
      className="w-full flex flex-col items-center px-4 md:px-6"
      ref={containerRef}
    >
      {/* CSS grid container hosting note cards */}
      <div className="css-grid-container" style={gridStyles}>
        {displayedNotes.map((note) => (
          <GridNoteItem
            key={note.id}
            note={note}
            itemWidth={itemWidth}
            eventHandlers={eventHandlers}
            replyHandlers={replyHandlers}
            stateManagement={stateManagement}
            configuration={configuration}
            hasActiveReplyForm={props.hasActiveReplyForm}
          />
        ))}
      </div>

      {/* Infinite-scroll sentinel for server-driven pagination */}
      {hasMore && onLoadMore && (
        <div ref={loadMoreTriggerRef} className="h-4 w-full" />
      )}

      {/* Loading indicator shown while fetching more */}
      {isLoadingMore && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading more notes...
          </span>
        </div>
      )}

      {/* Progress footer when more items exist */}
      {hasMore && !isLoadingMore && (
        <div className="flex justify-center items-center mt-6 pb-4">
          <div className="text-sm text-muted-foreground">
            Showing {displayedItemsCount} of {notes.length} notes
          </div>
        </div>
      )}

      {/* Manual load-more (server or local pagination) */}
      {(hasMore || hasMorePages) && !isLoadingMore && (
        <div className="flex justify-center items-center gap-4 mt-4 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            Load More (
            {hasMore
              ? "from server"
              : `${Math.min(5 * notesPerPage, notes.length - displayedItemsCount)} more`}
            )
          </Button>
        </div>
      )}
    </div>
  );
}
