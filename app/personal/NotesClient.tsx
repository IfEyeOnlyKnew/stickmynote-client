"use client"

/**
 * NotesClient (client component)
 *
 * Purpose
 * - Interactive notes dashboard UI for the /personal route.
 * - Receives SSR props (initialNotes, userId, stats) and progressively enhances with client-side data & actions.
 *
 * Inputs
 * - initialNotes: first page of notes fetched on the server for TTFB
 * - userId: authenticated user id (required for all interactions)
 * - stats: precomputed counts (total/personal/shared) for sidebar
 *
 * Responsibilities
 * - Search & filter notes (all/personal/shared)
 * - Create, update, delete notes (topic/content/details, color, sharing)
 * - Infinite loading via VirtualizedNoteGrid
 * - Fullscreen editing via UnifiedNote in a Dialog
 * - Reply management and tag generation hooks
 * - Undo deletion UX and a stats sidebar
 *
 * Error/edge cases
 * - If not client yet or missing user id => render loading/auth prompt
 * - Network/DB errors are surfaced via a simple error panel
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Plus, Search, Undo2, X, BarChart3, ChevronLeft, FolderPlus, Check, FolderOpen } from "lucide-react"
import type { Note } from "@/types/note"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SimpleNoteGrid } from "@/components/SimpleNoteGrid"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

// hooks and utils
import { useNotes } from "@/hooks/useNotes"
import { useFullscreenNote } from "@/hooks/useFullscreenNote"
import { useWindowSize } from "@/hooks/useWindowSize"
import { useUserProfile } from "@/hooks/useUserProfile"
import { useCSRF } from "@/hooks/useCSRF"
import { COLORS } from "@/utils/noteUtils"

// components
import { UnifiedNote } from "@/components/UnifiedNote"
import {
  CommunicationPaletteProvider,
  CommunicationModals,
} from "@/components/communication"
import { PersonalGroupsSidebar } from "@/components/personal-groups-sidebar"
import { usePersonalGroups } from "@/hooks/usePersonalGroups"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Props contract passed from server component (page.tsx)
interface NotesClientProps {
  initialNotes: Note[]
  userId: string
  stats: { total: number; personal: number; shared: number }
}

export function NotesClient({ initialNotes, userId, stats }: Readonly<NotesClientProps>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stickParam = searchParams.get("stick")
  const windowSize = useWindowSize()
  const { userProfile } = useUserProfile(userId)
  const { csrfToken } = useCSRF()
  const csrfTokenRef = useRef<string | null>(csrfToken)

  useEffect(() => {
    csrfTokenRef.current = csrfToken
  }, [csrfToken])

  // Gate to avoid kicking off client fetches until we confirm client + user id
  const [shouldLoad, setShouldLoad] = useState(false)

  const hasInitializedRef = useRef(false)

  // Main data/CRUD hook for notes lifecycle
  const {
    allNotes,
    setAllNotes,
    loading,
    loadingMore,
    error,
    deletedNotes = [],
    showUndoBar,
    generatingTags,
    hasMore,
    handleCreateNote,
    loadMoreNotes,
    handleNoteContentChange,
    handleNoteTopicChange,
    handleUpdateNote,
    handleUpdateNoteSharing,
    handleUpdateNoteColor,
    handleDeleteNote,
    handleUndoDelete,
    handleClearUndo,
    clearAllNotes,
    handleGenerateTags,
    markInitialized,
  } = useNotes(userId, shouldLoad)

  // Fullscreen editing hook
  const fullscreenHook = useFullscreenNote({
    allNotes: allNotes || [],
    onDeleteNote: handleDeleteNote,
    onUpdateNote: handleUpdateNote,
    onUpdateNoteSharing: handleUpdateNoteSharing,
    onUpdateNoteColor: handleUpdateNoteColor,
  })

  // UI state
  const [searchTerm, setSearchTerm] = useState("")
  const [searchFilter, setSearchFilter] = useState("all")
  const [selectedColor] = useState<(typeof COLORS)[number]>(COLORS[0])
  const [isClient, setIsClient] = useState(false)
  const [summarizingLinks, setSummarizingLinks] = useState<string | null>(null)

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Groups hook
  const groupsHook = usePersonalGroups(shouldLoad)
  const isMobile = useIsMobile()
  const [mobileGroupsOpen, setMobileGroupsOpen] = useState(false)

  // Track loading state when clicking a card
  const [loadingNoteId, setLoadingNoteId] = useState<string | null>(null)

  // Derived lists - deduplicated to prevent duplicate key warnings
  const uniqueNotes = useMemo(() => {
    const seen = new Set<string>()
    return allNotes.filter((note) => {
      if (seen.has(note.id)) return false
      seen.add(note.id)
      return true
    })
  }, [allNotes])
  
  const personalNotes = useMemo(() => uniqueNotes.filter((n) => !n.is_shared), [uniqueNotes])
  const sharedNotes = useMemo(() => uniqueNotes.filter((n) => n.is_shared), [uniqueNotes])

  // Compute filtered set based on search term + filter selection + group
  const filteredNotes = useMemo(() => {
    let notesToFilter: Note[]
    if (searchFilter === "personal") notesToFilter = personalNotes
    else if (searchFilter === "shared") notesToFilter = sharedNotes
    else notesToFilter = uniqueNotes

    // Filter by selected group
    if (groupsHook.selectedGroupId) {
      const groupStickIds = groupsHook.getStickIdsForGroup(groupsHook.selectedGroupId)
      notesToFilter = notesToFilter.filter((note) => groupStickIds.has(note.id))
    }

    if (!searchTerm.trim()) return notesToFilter
    const s = searchTerm.toLowerCase()
    return notesToFilter.filter(
      (note) => (note.topic || "").toLowerCase().includes(s) || (note.content || "").toLowerCase().includes(s),
    )
  }, [uniqueNotes, personalNotes, sharedNotes, searchTerm, searchFilter, groupsHook.selectedGroupId, groupsHook.getStickIdsForGroup])

  // Create a new note and open it in fullscreen immediately
  const handleCreateNoteClick = useCallback(async () => {
    if (!userId || !isClient) {
      router.push("/")
      return
    }
    try {
      const newNote = await handleCreateNote(selectedColor.value, windowSize)
      // Open the new note in fullscreen immediately for editing
      fullscreenHook.openFullscreen(newNote.id)
    } catch (err) {
      console.error("Error creating note:", err)
    }
  }, [userId, isClient, router, handleCreateNote, selectedColor, windowSize, fullscreenHook])

  // Handle clicking a card to open fullscreen
  const handleNoteClick = useCallback((noteId: string) => {
    setLoadingNoteId(noteId)
    fullscreenHook.openFullscreen(noteId)
    // Clear loading state after a short delay
    setTimeout(() => setLoadingNoteId(null), 300)
  }, [fullscreenHook])

  // Persist "details" (note tabs) via API route
  const handleNoteDetailsChange = useCallback(async (noteId: string, details: string) => {
    try {
      const response = await fetch("/api/note-tabs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, details }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to save details")
      }
    } catch (error) {
      console.error("Error saving details:", error)
    }
  }, [])

  // Thin wrapper to bind handleGenerateTags with consumer signature
  const handleGenerateTagsWrapper = useCallback(
    (noteId: string, topic: string) => {
      handleGenerateTags(noteId, topic)
    },
    [handleGenerateTags],
  )

  // Handler for summarizing links of a note
  const handleSummarizeLinks = useCallback(
    async (noteId: string) => {
      setSummarizingLinks(noteId)
      try {
        const response = await fetch(`/api/notes/${noteId}/summarize-links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) {
          throw new Error("Failed to summarize links")
        }

        const data = await response.json()

        // Update the note with the new details
        if (data.details) {
          setAllNotes((prev) =>
            prev.map((n) =>
              n.id === noteId
                ? { ...n, details: data.details }
                : n
            )
          )
        }
      } catch (error) {
        console.error("Error summarizing links:", error)
      } finally {
        setSummarizingLinks(null)
      }
    },
    [setAllNotes],
  )


  // Account deletion (double-confirm) with redirect on success
  const handleDeleteAccount = useCallback(async () => {
    if (!userId) return
    const c1 = globalThis.confirm("⚠️ This will permanently delete your account and ALL your notes. Continue?")
    if (!c1) return
    const c2 = globalThis.confirm("Final confirmation. This cannot be undone. Proceed?")
    if (!c2) return
    try {
      const response = await fetch("/api/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      if (!response.ok) throw new Error("Failed to delete account")
      setTimeout(() => (globalThis.location.href = "/"), 2000)
    } catch (error) {
      console.error("Error deleting account:", error)
    }
  }, [userId])

  const handleNoteUpdate = useCallback(
    async (noteId: string) => {
      try {
        if (!userId) {
          return
        }

        // Fetch note data via API
        const response = await fetch(`/api/notes/${noteId}`, {
          credentials: "include",
        })

        if (!response.ok) {
          console.error("Error fetching updated note:", response.statusText)
          return
        }

        const updatedNote = await response.json()

        if (updatedNote) {
          const noteWithDetails = {
            ...updatedNote,
            details: updatedNote.details || "",
            tags: updatedNote.tags || [],
            images: updatedNote.images || [],
            videos: updatedNote.videos || [],
            hyperlinks: updatedNote.hyperlinks || [],
          }

          setAllNotes((prev) => prev.map((note) => (note.id === noteId ? noteWithDetails : note)))
        }
      } catch (error) {
        console.error("Error updating note:", error)
      }
    },
    [userId, setAllNotes],
  )

  // Extracted state updaters to reduce function nesting depth
  const updateNoteReply = useCallback((replyId: string, updatedReply: any) => {
    setAllNotes((prev) =>
      prev.map((note) => ({
        ...note,
        replies: (note.replies || []).map((r) =>
          r.id === replyId ? { ...r, ...updatedReply } : r
        ),
      }))
    )
  }, [setAllNotes])

  const removeNoteReply = useCallback((replyId: string) => {
    setAllNotes((prev) =>
      prev.map((note) => ({
        ...note,
        replies: (note.replies || []).filter((r) => r.id !== replyId),
      }))
    )
  }, [setAllNotes])

  // Reply handlers - inline to match /panel implementation
  const handleAddReply = useCallback(async (noteId: string, content: string, color?: string, parentReplyId?: string | null): Promise<void> => {
    console.log("[Personal handleAddReply] Called with:", { noteId, content: content.substring(0, 30), color, parentReplyId })
    try {
      const currentCsrfToken = csrfTokenRef.current
      const requestBody = { content, color: color || "#f3f4f6", parent_reply_id: parentReplyId || null }
      console.log("[Personal handleAddReply] Request body:", requestBody)
      const response = await fetch(`/api/notes/${noteId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentCsrfToken ? { "X-CSRF-Token": currentCsrfToken } : {}),
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add reply")
      }

      const { reply } = await response.json()
      setAllNotes((prev) =>
        prev.map((note) =>
          note.id === noteId
            ? { ...note, replies: [...(note.replies || []), reply] }
            : note
        )
      )
    } catch (error) {
      console.error("Error adding reply:", error)
      throw error
    }
  }, [setAllNotes])

  const handleEditReply = useCallback(async (noteId: string, replyId: string, content: string): Promise<void> => {
    try {
      const currentCsrfToken = csrfTokenRef.current
      const response = await fetch(`/api/notes/${noteId}/replies`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(currentCsrfToken ? { "X-CSRF-Token": currentCsrfToken } : {}),
        },
        body: JSON.stringify({ replyId, content }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to edit reply")
      }

      const { reply: updatedReply } = await response.json()
      updateNoteReply(replyId, updatedReply)
    } catch (error) {
      console.error("Error editing reply:", error)
      throw error
    }
  }, [updateNoteReply])

  const handleDeleteReply = useCallback(async (noteId: string, replyId: string): Promise<void> => {
    try {
      const currentCsrfToken = csrfTokenRef.current
      const response = await fetch(`/api/notes/${noteId}/replies`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(currentCsrfToken ? { "X-CSRF-Token": currentCsrfToken } : {}),
        },
        body: JSON.stringify({ replyId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete reply")
      }

      removeNoteReply(replyId)
    } catch (error) {
      console.error("Error deleting reply:", error)
      throw error
    }
  }, [removeNoteReply])

  // Mark client-side readiness
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!userId) {
      return
    }

    // Only initialize once with initialNotes (even if empty)
    if (!hasInitializedRef.current) {
      if (initialNotes.length > 0) {
        // Deduplicate initialNotes before setting
        const uniqueNotes = initialNotes.filter(
          (note, index, self) => index === self.findIndex((n) => n.id === note.id)
        )
        setAllNotes(uniqueNotes)
        // Mark the data hook as initialized to prevent refetching the same notes
        markInitialized()
      }
      hasInitializedRef.current = true
    }

    // Enable shouldLoad after initialization - but this is now safe because
    // useNotesData's loadNotes will check hasInitialLoadedRef before fetching
    if (!shouldLoad && hasInitializedRef.current) {
      setShouldLoad(true)
    }
  }, [userId, shouldLoad, initialNotes, setAllNotes, markInitialized])

  // Auto-open a stick from ?stick= URL param (e.g. linked from Noted "Go to Stick")
  const stickParamHandledRef = useRef(false)
  useEffect(() => {
    if (stickParamHandledRef.current || !stickParam || allNotes.length === 0) return
    const note = allNotes.find((n) => n.id === stickParam)
    if (note) {
      stickParamHandledRef.current = true
      fullscreenHook.openFullscreen(note.id)
    }
  }, [stickParam, allNotes, fullscreenHook])

  // Click-outside handler for stats sidebar
  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!isSidebarOpen) return
      const sidebar = document.getElementById("notes-sidebar")
      const trigger = document.getElementById("sidebar-trigger")
      if (sidebar && trigger && !sidebar.contains(event.target as Node) && !trigger.contains(event.target as Node)) {
        setIsSidebarOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [isSidebarOpen])

  // Optional: fetch avatar (currently unused) for potential future UI
  // Avatar can be fetched from /api/user/me if needed in the future

  // Guard: wait until we've mounted on the client
  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Guard: if somehow missing user id on client, prompt for auth
  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to access your notes and continue using the application.</p>
          <div className="space-y-3">
            <Button onClick={() => router.push("/auth")} className="w-full">
              Sign In
            </Button>
            <Button onClick={() => router.push("/")} variant="outline" className="w-full">
              Go Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Guard: wait until we've allowed hooks to kick off loading
  if (!shouldLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <CommunicationPaletteProvider>
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header: title, search, filter, creation & navigation actions, user menu */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto pl-14 pr-4 py-3 md:px-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Personal Sticks", current: true },
            ]}
          />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-3">
            {/* Left section: Title and Search */}
            <div className="flex items-center gap-2 lg:gap-3 flex-1 w-full sm:w-auto">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold whitespace-nowrap flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Personal Sticks
              </h1>

              <div className="relative flex-1 min-w-[120px] sm:min-w-[150px] max-w-full sm:max-w-[250px] lg:max-w-[400px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>

            {/* Right section: Filter, Buttons, and User Menu */}
            <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto justify-end">
              {/* Mobile groups toggle */}
              {isMobile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileGroupsOpen(true)}
                  className="flex items-center gap-1.5 flex-shrink-0"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="text-xs">Groups</span>
                </Button>
              )}

              <Select value={searchFilter} onValueChange={setSearchFilter}>
                <SelectTrigger className="w-20 md:w-32 lg:w-36 flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                onClick={handleCreateNoteClick}
                className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                size="default"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden md:inline font-medium">Stick</span>
              </Button>

              <div className="flex-shrink-0">
                <UserMenu
                  showAbout={true}
                  showClearAllNotes={true}
                  showDeleteAccount={true}
                  onClearAllNotes={clearAllNotes}
                  onDeleteAccount={handleDeleteAccount}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content: sidebar + notes grid */}
      <div className="flex min-h-[calc(100vh-200px)]">
        {/* Groups Sidebar */}
        <PersonalGroupsSidebar
          groups={groupsHook.groups}
          selectedGroupId={groupsHook.selectedGroupId}
          onSelectGroup={groupsHook.setSelectedGroupId}
          onCreateGroup={groupsHook.createGroup}
          onRenameGroup={(id, name) => groupsHook.updateGroup(id, { name })}
          onDeleteGroup={groupsHook.deleteGroup}
          mobileOpen={mobileGroupsOpen}
          onMobileClose={() => setMobileGroupsOpen(false)}
        />

        {/* Notes grid: simple responsive grid with card previews */}
        <div className="relative flex-1 pt-4 md:pt-8 px-2 md:px-6">
          {/* Active group indicator */}
          {groupsHook.selectedGroupId && (
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: groupsHook.groups.find((g) => g.id === groupsHook.selectedGroupId)?.color }}
              />
              <span className="text-sm font-medium text-gray-700">
                {groupsHook.groups.find((g) => g.id === groupsHook.selectedGroupId)?.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => groupsHook.setSelectedGroupId(null)}
                className="h-6 text-xs text-gray-500"
              >
                Clear filter
              </Button>
            </div>
          )}

          {filteredNotes.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium mb-2">No notes found</h3>
              <p className="text-sm">
                {(() => {
                  if (groupsHook.selectedGroupId) return "No sticks in this group yet. Open a stick and add it to this group."
                  if (searchTerm) return "Try adjusting your search or filter"
                  return "Create your first note to get started!"
                })()}
              </p>
            </div>
          ) : (
            <SimpleNoteGrid
              notes={filteredNotes}
              onNoteClick={handleNoteClick}
              onUpdateColor={handleUpdateNoteColor}
              onLoadMore={loadMoreNotes}
              hasMore={hasMore}
              isLoadingMore={loadingMore}
              loadingNoteId={loadingNoteId}
            />
          )}
        </div>
      </div>

      {/* Floating Stats Button toggling the sidebar */}
      <Button
        id="sidebar-trigger"
        onClick={() => setIsSidebarOpen((p) => !p)}
        className="fixed bottom-6 right-6 z-[9997] shadow-lg hover:shadow-xl transition-shadow duration-200 rounded-full w-14 h-14 p-0"
        size="lg"
      >
        <BarChart3 className="h-6 w-6" />
      </Button>

      {/* Sidebar: notes/user stats summary */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/50 transition-opacity duration-300">
          <div
            id="notes-sidebar"
            className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
              isSidebarOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between p-6 border-b bg-gray-50">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-800">Notes Statistics</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)} className="hover:bg-gray-200">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">User Information</span>
                  <span className="text-2xl font-bold text-blue-600">{userProfile?.username || userId || "User"}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-800 border-b pb-2">Notes Overview</h3>
                <div className="grid gap-3">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">All Notes</span>
                      <span className="text-2xl font-bold text-green-600">{stats.total}</span>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-purple-800">My Notes</span>
                      <span className="text-2xl font-bold text-purple-600">{stats.personal}</span>
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-orange-800">Shared Notes</span>
                      <span className="text-2xl font-bold text-orange-600">{stats.shared}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">Current View</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Filter:</span>
                    <span className="font-medium capitalize">{searchFilter}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Showing:</span>
                    <span className="font-medium">{filteredNotes.length} notes</span>
                  </div>
                  {searchTerm && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Search:</span>
                      <span className="font-medium truncate max-w-32">&quot;{searchTerm}&quot;</span>
                    </div>
                  )}
                </div>
              </div>

              {userProfile && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Settings</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Auto-Organize:</span>
                      <span className="font-medium">{userProfile.organize_notes ? "✅ Enabled" : "❌ Disabled"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Undo Bar: transient feedback to restore deleted notes */}
      {showUndoBar && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <span className="text-sm">
            {deletedNotes.length} {deletedNotes.length === 1 ? "note" : "notes"} deleted
          </span>
          <Button variant="ghost" size="sm" onClick={handleUndoDelete} className="text-white hover:text-gray-200">
            <Undo2 className="h-4 w-4 mr-1" />
            Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearUndo} className="text-white hover:text-gray-200">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Fullscreen Note Modal: edit a single note in depth */}
      {fullscreenHook.fullscreenNoteId && (
        <Dialog open={true} onOpenChange={() => fullscreenHook.closeFullscreen()}>
          <DialogContent className="max-w-[95vw] xl:max-w-[1600px] w-full h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] p-4 overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Note Details</DialogTitle>
            </DialogHeader>
            {/* Group assignment dropdown */}
            {fullscreenHook.fullscreenNoteId && groupsHook.groups.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <FolderPlus className="h-3.5 w-3.5" />
                      Groups
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {groupsHook.groups.map((group) => {
                      const isInGroup = groupsHook.getGroupsForStick(fullscreenHook.fullscreenNoteId!).includes(group.id)
                      return (
                        <DropdownMenuItem
                          key={group.id}
                          onClick={() =>
                            isInGroup
                              ? groupsHook.removeStickFromGroup(group.id, fullscreenHook.fullscreenNoteId!)
                              : groupsHook.addStickToGroup(group.id, fullscreenHook.fullscreenNoteId!)
                          }
                          className="gap-2"
                        >
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: group.color }} />
                          <span className="flex-1">{group.name}</span>
                          {isInGroup && <Check className="h-3.5 w-3.5 text-green-600" />}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Show current group badges */}
                {groupsHook.getGroupsForStick(fullscreenHook.fullscreenNoteId).map((gId) => {
                  const group = groupsHook.groups.find((g) => g.id === gId)
                  if (!group) return null
                  return (
                    <span
                      key={gId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: group.color }}
                    >
                      {group.name}
                      <button
                        type="button"
                        title="Remove from group"
                        onClick={() => groupsHook.removeStickFromGroup(gId, fullscreenHook.fullscreenNoteId!)}
                        className="hover:bg-white/20 rounded-full p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
            {fullscreenHook.fullscreenNoteId && (
              <UnifiedNote
                note={allNotes.find((n) => n.id === fullscreenHook.fullscreenNoteId)!}
                mode="fullscreen"
                currentUserId={userId}
                onClose={fullscreenHook.closeFullscreen}
                onUpdateSharing={(noteId: string, isShared: boolean) =>
                  handleUpdateNoteSharing?.(noteId, isShared)
                }
                onTopicChange={(noteId: string, topic: string) =>
                  handleNoteTopicChange?.(noteId, topic)
                }
                onContentChange={(noteId: string, content: string) =>
                  handleNoteContentChange?.(noteId, content)
                }
                onDetailsChange={(noteId: string, details: string) => handleNoteDetailsChange(noteId, details)}
                onUpdateColor={handleUpdateNoteColor}
                onGenerateTags={handleGenerateTagsWrapper}
                generatingTags={generatingTags}
                onSummarizeLinks={handleSummarizeLinks}
                summarizingLinks={summarizingLinks}
                onAddReply={handleAddReply}
                onEditReply={handleEditReply}
                onDeleteReply={handleDeleteReply}
                onNoteUpdate={(updatedNote) => {
                  setAllNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)))
                  handleNoteUpdate(updatedNote.id)
                }}
                readOnly={false}
                onDeleteNote={handleDeleteNote}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Error surface: simple fixed panel; upstream hooks set `error` */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
          {error}
        </div>
      )}

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}
