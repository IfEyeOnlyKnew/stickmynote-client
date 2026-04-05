"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Trash2, MoreVertical, BookOpen, Loader2, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { NotedPage, NotedGroup } from "@/hooks/useNoted"

interface NotedPageListProps {
  pages: NotedPage[]
  groups: NotedGroup[]
  selectedPageId: string | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectPage: (page: NotedPage) => void
  onDeletePage: (id: string) => void
  onMoveToGroup: (pageId: string, groupId: string | null) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  onNewPage?: () => void
}

export function NotedPageList({
  pages,
  groups,
  selectedPageId,
  searchQuery,
  onSearchChange,
  onSelectPage,
  onDeletePage,
  onMoveToGroup,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onNewPage,
}: Readonly<NotedPageListProps>) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, onLoadMore])

  const stripHtml = (html: string) => {
    if (!html) return ""
    return html.replaceAll(/<[^>]*>/g, "").slice(0, 100)
  }

  return (
    <div className="flex flex-col h-full border-r">
      {/* Search + New Page */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search pages..."
            className="pl-8 h-9"
          />
        </div>
        {onNewPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNewPage}
            className="w-full h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Page
          </Button>
        )}
      </div>

      {/* Page list */}
      <ScrollArea className="flex-1">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No pages match your search" : "No pages yet. Click the Noted icon on any Stick to create one."}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {pages.map((page) => (
              <div
                key={page.id}
                tabIndex={0}
                onClick={() => onSelectPage(page)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectPage(page) }}
                className={cn(
                  "group flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                  selectedPageId === page.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    selectedPageId === page.id && "text-primary"
                  )}>
                    {page.display_title || page.title || "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {stripHtml(page.content)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(page.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {groups.length > 0 && (
                      <>
                        {groups.map((group) => (
                          <DropdownMenuItem
                            key={group.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              onMoveToGroup(page.id, group.id)
                            }}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
                              style={{ backgroundColor: group.color }}
                            />
                            Move to {group.name}
                          </DropdownMenuItem>
                        ))}
                        {page.group_id && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onMoveToGroup(page.id, null)
                            }}
                          >
                            Remove from group
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmId(page.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-3">
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Noted page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this page. The original Stick will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) onDeletePage(deleteConfirmId)
                setDeleteConfirmId(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
