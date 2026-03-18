"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2, BarChart3, Sparkles, TrendingUp, ChevronDown } from "lucide-react"

import { useUser } from "@/contexts/user-context"
import { useToast } from "@/hooks/use-toast"
import { useCSRF } from "@/hooks/useCSRF"
import type { Note, Reply } from "@/types/note"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { useWindowSize } from "@/hooks/useWindowSize"
import { useUserProfile } from "@/hooks/useUserProfile"
import { EnhancedSearchInput } from "@/components/panel/EnhancedSearchInput"
import { SearchFiltersPanel, type SearchFilters } from "@/components/panel/SearchFilters"
import { SearchEmptyState } from "@/components/panel/SearchEmptyState"
import { SearchResultsSkeletonGrid } from "@/components/panel/SearchResultSkeleton"
import { OptimisticSearchResultCard } from "@/components/panel/OptimisticSearchResultCard"
import { UnifiedNote } from "@/components/UnifiedNote"
import { SearchStatsDialog } from "@/components/SearchStatsDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  CommunicationPaletteProvider,
  CommunicationModals,
} from "@/components/communication"

const DEFAULT_CHUNK_SIZE = 9

export default function CommunityPanelPage() {
  const { user, loading: userLoading, isEmailVerified } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const windowSize = useWindowSize()
  useUserProfile(user?.id || null)
  const { csrfToken } = useCSRF()
  const csrfTokenRef = useRef<string | null>(csrfToken)

  useEffect(() => {
    csrfTokenRef.current = csrfToken
  }, [csrfToken])

  const [communityNotes, setCommunityNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const lastErrorTimeRef = useRef<number>(0)
  const [userAvatar] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [trendingTags, setTrendingTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    sortBy: "relevance",
  })
  const [totalResults, setTotalResults] = useState(0)
  const [pendingCount] = useState(0)
  const [showStats, setShowStats] = useState(false)
  const [fullscreenHook, setFullscreenHook] = useState<{
    isFullscreen: boolean
    fullscreenItem: string | null
    openFullscreen: (noteId: string) => void
    closeFullscreen: () => void
  }>({
    isFullscreen: false,
    fullscreenItem: null,
    openFullscreen: (noteId: string) => {
      setFullscreenHook((prev) => ({
        ...prev,
        isFullscreen: true,
        fullscreenItem: noteId,
      }))
    },
    closeFullscreen: () => {
      setFullscreenHook((prev) => ({
        ...prev,
        isFullscreen: false,
        fullscreenItem: null,
      }))
    },
  })
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)

  // Helper: Update note's replies with new reply
  const addReplyToNote = useCallback((noteId: string, reply: Reply) => {
    setCommunityNotes((prevNotes) =>
      prevNotes.map((note) => {
        if (note.id !== noteId) return note
        return { ...note, replies: [...(note.replies || []), reply] }
      }),
    )
  }, [])

  // Helper: Update specific reply in note (extracted mapper to reduce nesting)
  const createReplyMapper = (replyId: string, updatedReply: Partial<Reply>) => 
    (r: Reply): Reply => r.id === replyId ? { ...r, ...updatedReply } : r

  const updateReplyInNote = useCallback((noteId: string, replyId: string, updatedReply: Partial<Reply>) => {
    setCommunityNotes((prevNotes) =>
      prevNotes.map((note) => {
        if (note.id !== noteId) return note
        return { ...note, replies: note.replies?.map(createReplyMapper(replyId, updatedReply)) }
      }),
    )
  }, [])

  // Helper: Remove reply from note (extracted filter to reduce nesting)
  const createReplyFilter = (replyId: string) => 
    (r: Reply): boolean => r.id !== replyId

  const removeReplyFromNote = useCallback((noteId: string, replyId: string) => {
    setCommunityNotes((prevNotes) =>
      prevNotes.map((note) => {
        if (note.id !== noteId) return note
        return { ...note, replies: note.replies?.filter(createReplyFilter(replyId)) }
      }),
    )
  }, [])

  // Use a ref to always have access to current communityNotes
  const communityNotesRef = useRef<Note[]>(communityNotes)
  useEffect(() => {
    communityNotesRef.current = communityNotes
  }, [communityNotes])

  const handleAddReply = useCallback(async (noteId: string, content: string, color?: string, parentReplyId?: string | null): Promise<void> => {
    console.log("[Panel handleAddReply] Called with:", { noteId, content: content.substring(0, 30), color, parentReplyId })
    try {
      const currentCsrfToken = csrfTokenRef.current
      const requestBody = { content, color: color || "#fef3c7", parent_reply_id: parentReplyId || null }
      console.log("[Panel handleAddReply] Request body:", requestBody)
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
      addReplyToNote(noteId, reply)
    } catch (error) {
      console.error("Error adding reply:", error)
      throw error
    }
  }, [addReplyToNote])

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
      updateReplyInNote(noteId, replyId, updatedReply)
    } catch (error) {
      console.error("Error editing reply:", error)
      throw error
    }
  }, [updateReplyInNote])

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

      removeReplyFromNote(noteId, replyId)
    } catch (error) {
      console.error("Error deleting reply:", error)
      throw error
    }
  }, [removeReplyFromNote])

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [circuitOpen, setCircuitOpen] = useState(false)
  const circuitOpenTimeRef = useRef<number>(0)
  const CIRCUIT_BREAKER_TIMEOUT = 30000 // 30 seconds cool down after rate limit

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Helper: Check if circuit breaker should block request
  const isCircuitBreakerBlocking = useCallback(() => {
    const now = Date.now()
    if (!circuitOpen) return false
    
    if (now - circuitOpenTimeRef.current < CIRCUIT_BREAKER_TIMEOUT) {
      console.warn(
        `Circuit breaker open - ${Math.ceil((CIRCUIT_BREAKER_TIMEOUT - (now - circuitOpenTimeRef.current)) / 1000)}s remaining`,
      )
      return true
    }
    // Reset circuit breaker after timeout
    setCircuitOpen(false)
    return false
  }, [circuitOpen])

  // Helper: Handle rate limit response
  const handleRateLimitResponse = useCallback(() => {
    console.warn("Rate limited - circuit breaker activated for 30 seconds")
    setCircuitOpen(true)
    circuitOpenTimeRef.current = Date.now()
    setLoadError(true)
    lastErrorTimeRef.current = Date.now()
    setHasMore(false)
  }, [])

  // Helper: Handle non-JSON response
  const handleNonJsonResponse = useCallback(async (response: Response) => {
    console.warn("Non-JSON response received:", await response.text().catch(() => "unable to read"))
    setLoadError(true)
    lastErrorTimeRef.current = Date.now()
    setHasMore(false)
  }, [])

  // Helper: Update notes from search response
  const updateNotesFromResponse = useCallback((data: { notes?: Note[]; totalCount?: number; hasMore?: boolean }, pageToFetch: number) => {
    const newNotes = data.notes || []
    const totalCount = data.totalCount || 0
    const moreAvailable = data.hasMore || false

    if (pageToFetch === 1) {
      setCommunityNotes(newNotes)
    } else {
      setCommunityNotes((prev) => {
        const existingIds = new Set(prev.map((n) => n.id))
        const uniqueNewNotes = newNotes.filter((n: Note) => !existingIds.has(n.id))
        return [...prev, ...uniqueNewNotes]
      })
    }

    setTotalResults(totalCount)
    setHasMore(moreAvailable)
    setLoadError(false)
  }, [])

  const searchCommunityNotes = useCallback(
    async (pageToFetch: number) => {
      if (!user) {
        setLoading(false)
        return
      }

      if (isCircuitBreakerBlocking()) return

      const now = Date.now()
      if (loadError && now - lastErrorTimeRef.current < 10000) return

      if (pageToFetch === 1) {
        setLoading(true)
        setLoadError(false)
      } else {
        if (isLoadingMore) return
        setIsLoadingMore(true)
      }

      try {
        const currentCsrfToken = csrfTokenRef.current
        const response = await fetch("/api/search/panel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(currentCsrfToken ? { "X-CSRF-Token": currentCsrfToken } : {}),
          },
          body: JSON.stringify({
            query: debouncedSearchTerm,
            filters: { ...searchFilters, sortBy: searchFilters.sortBy || "newest" },
            page: pageToFetch,
            limit: DEFAULT_CHUNK_SIZE,
          }),
        })

        if (response.status === 429) {
          handleRateLimitResponse()
          return
        }

        const contentType = response.headers.get("content-type")
        if (!contentType?.includes("application/json")) {
          await handleNonJsonResponse(response)
          return
        }

        if (!response.ok) throw new Error("Failed to search")

        const data = await response.json()
        updateNotesFromResponse(data, pageToFetch)
      } catch (err) {
        console.error("Error fetching panel notes:", err)
        setLoadError(true)
        lastErrorTimeRef.current = Date.now()
        if (now - lastErrorTimeRef.current < 5000) {
          setCircuitOpen(true)
          circuitOpenTimeRef.current = Date.now()
        }
        setHasMore(false)
      } finally {
        setLoading(false)
        setIsLoadingMore(false)
      }
    },
    [user, debouncedSearchTerm, searchFilters, loadError, isLoadingMore, isCircuitBreakerBlocking, handleRateLimitResponse, handleNonJsonResponse, updateNotesFromResponse],
  )

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !loadError) {
      searchCommunityNotes(2)
    }
  }, [isLoadingMore, hasMore, searchCommunityNotes, loadError])

  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term)
  }, [])

  const handleSearch = useCallback(
    (term: string) => {
      if (term.trim() && !recentSearches.includes(term)) {
        setRecentSearches((prev) => [term, ...prev.slice(0, 4)])
      }
    },
    [recentSearches],
  )

  const handleTagClick = useCallback(
    (tag: string) => {
      setSearchTerm(tag)
      handleSearch(tag)
    },
    [handleSearch],
  )

  const handleClearFilters = useCallback(() => {
    setSearchFilters({ sortBy: "relevance" })
    setSearchTerm("")
  }, [])

  const handleNoteClick = useCallback(
    async (noteId: string, position: number) => {
      if (searchTerm.trim() && user?.id) {
        try {
          const currentCsrfToken = csrfTokenRef.current
          await fetch("/api/search/track-click", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(currentCsrfToken ? { "X-CSRF-Token": currentCsrfToken } : {}),
            },
            body: JSON.stringify({
              user_id: user.id,
              query: searchTerm,
              note_id: noteId,
              position,
            }),
          })
        } catch (error) {
          console.warn("Failed to track click:", error)
        }
      }
      fullscreenHook.openFullscreen(noteId)
    },
    [searchTerm, user?.id, fullscreenHook, csrfTokenRef],
  )

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!user) return
      try {
        const response = await fetch("/api/search/panel/suggestions")
        if (response.ok) {
          const data = await response.json()
          setRecentSearches(data.recent || [])
          setTrendingTags(data.trending || [])
          setAvailableTags(data.tags || [])
        }
      } catch (error) {
        console.warn("Failed to fetch suggestions:", error)
      }
    }
    fetchSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!userLoading && (!user || !isEmailVerified)) {
      if (!user) {
        router.push("/")
      } else if (!isEmailVerified) {
        router.push("/auth/verify-email")
      }
    }
  }, [user, userLoading, isEmailVerified, router])

  useEffect(() => {
    if (user && !circuitOpen) {
      searchCommunityNotes(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, debouncedSearchTerm, searchFilters, circuitOpen])

  useEffect(() => {
    const node = loadMoreTriggerRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !isLoadingMore && !loading) {
          handleLoadMore()
        }
      },
      { rootMargin: "200px 0px" },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, isLoadingMore, loading, handleLoadMore])

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="panel-loading">
          <Loader2 className="h-10 w-10 text-indigo-600 panel-loading-spinner" />
          <p className="text-sm font-medium text-gray-600">Loading panel...</p>
        </div>
      </div>
    )
  }

  if (!userLoading && user && !isEmailVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">📧</div>
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Email Verification Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please check your email and click the verification link to access the Community Sticks.
          </p>
          <Button
            onClick={() => router.push("/auth/verify-email")}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            Learn More
          </Button>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Extracted handlers for UnifiedNote (reduces nesting depth)
  const handleNoteUpdateInFullscreen = (updatedNote: Note) => {
    setCommunityNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)))
  }

  const handleDeleteNoteInFullscreen = async (noteId: string) => {
    const note = communityNotes.find((n) => n.id === noteId)
    if (note?.user_id !== user?.id) return
    
    try {
      await fetch(`/api/notes/${noteId}`, { method: "DELETE" })
      setCommunityNotes((prev) => prev.filter((n) => n.id !== noteId))
      fullscreenHook.closeFullscreen()
      toast({
        title: "Success",
        description: "Note deleted successfully",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      })
    }
  }

  const handleUpdateSharingInFullscreen = async (noteId: string, isShared: boolean) => {
    setCommunityNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, is_shared: isShared } : n)))
  }

  const handleUpdateColorInFullscreen = async (noteId: string, color: string) => {
    setCommunityNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, color } : n)))
  }

  const handleTopicChangeInFullscreen = async (noteId: string, topic: string) => {
    setCommunityNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, topic } : n)))
  }

  const handleContentChangeInFullscreen = async (noteId: string, content: string) => {
    setCommunityNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, content } : n)))
  }

  const handleGenerateTagsInFullscreen = async (noteId: string) => {
    try {
      const currentCsrfToken = csrfTokenRef.current
      const response = await fetch("/api/generate-tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentCsrfToken ? { "X-CSRF-Token": currentCsrfToken } : {}),
        },
        body: JSON.stringify({ noteId }),
      })
      if (response.ok) {
        const { tags } = await response.json()
        setCommunityNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, tags } : n)))
        toast({
          title: "Success",
          description: "Tags generated successfully",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate tags",
        variant: "destructive",
      })
    }
  }

  // Helper: Render empty state for no search term
  const renderNoSearchEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No recent sticks found</h3>
      <p className="text-gray-500 text-center max-w-sm">Check back later for new updates from the community.</p>
    </div>
  )

  // Helper: Render load more button
  const renderLoadMoreButton = (label: string) => (
    <div className="flex justify-center pb-12">
      <Button
        onClick={handleLoadMore}
        disabled={isLoadingMore}
        variant="outline"
        size="lg"
        className="rounded-full px-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm bg-transparent"
      >
        {isLoadingMore ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading more...
          </>
        ) : (
          <>
            Show {pendingCount > 0 ? pendingCount : DEFAULT_CHUNK_SIZE} {label}
            <ChevronDown className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  )

  // Helper: Render recent shared sticks (no search term)
  const renderRecentSticks = () => (
    <div className="container mx-auto px-4">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Recent Shared Sticks
        </h2>
        <p className="text-gray-600 mt-2">Explore the latest from the community</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
        {communityNotes.map((note, index) => (
          <OptimisticSearchResultCard
            key={note.id}
            note={note}
            onOpen={(noteId) => handleNoteClick(noteId, index)}
            currentUserId={user?.id}
          />
        ))}
      </div>
      {hasMore && renderLoadMoreButton("Shared Sticks")}
    </div>
  )

  // Helper: Render search results
  const renderSearchResults = () => (
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
        {communityNotes.map((note, index) => (
          <OptimisticSearchResultCard
            key={note.id}
            note={note}
            searchTerm={searchTerm}
            onOpen={(noteId) => handleNoteClick(noteId, index)}
            currentUserId={user?.id}
          />
        ))}
      </div>
      {hasMore && renderLoadMoreButton("Results")}
    </div>
  )

  // Helper: Render main content based on state
  const renderMainContent = () => {
    const hasSearchTerm = searchTerm.trim()
    
    if (!hasSearchTerm) {
      if (loading) return <SearchResultsSkeletonGrid count={9} />
      if (communityNotes.length === 0) return renderNoSearchEmptyState()
      return renderRecentSticks()
    }
    
    if (loading) return <SearchResultsSkeletonGrid count={6} />
    if (communityNotes.length === 0) {
      return (
        <SearchEmptyState
          type="no-results"
          searchQuery={searchTerm}
          trendingTags={trendingTags}
          onTagClick={handleTagClick}
          onClearFilters={handleClearFilters}
        />
      )
    }
    return renderSearchResults()
  }

  return (
    <CommunicationPaletteProvider>
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative panel-page-transition">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-indigo-100 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="panel-breadcrumb-enhanced mb-3">
            <BreadcrumbNav
              items={[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Comm Sticks", current: true },
              ]}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
              <div className="flex items-center gap-3">
                {userAvatar && (
                  <div className="panel-avatar-ring w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-200 shadow-md">
                    <Image
                      src={userAvatar || "/placeholder.svg"}
                      alt="User Avatar"
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Community Sticks
                  </h1>
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
              </div>

              <div className="relative w-full sm:flex-1">
                <EnhancedSearchInput
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onSearch={handleSearch}
                  recentSearches={recentSearches}
                  trendingTags={trendingTags}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              <UserMenu showAbout={true} />
            </div>
          </div>

          {searchTerm && (
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <SearchFiltersPanel filters={searchFilters} onChange={setSearchFilters} availableTags={availableTags} />

              {communityNotes.length > 0 && !loading && (
                <div className="panel-result-count inline-flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>
                    Found {totalResults} note{totalResults === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative min-h-[calc(100vh-200px)] pt-8 panel-scrollbar">
        {renderMainContent()}
        <div ref={loadMoreTriggerRef} aria-hidden="true" className="h-1 w-full" />
      </div>

      <Button
        id="sidebar-trigger"
        onClick={() => {
          setShowStats(true)
        }}
        className="panel-fab fixed bottom-6 right-6 z-[9997] rounded-full w-16 h-16 p-0 border-0"
        size="lg"
      >
        <BarChart3 className="h-7 w-7 text-white" />
      </Button>

      {fullscreenHook.isFullscreen &&
        fullscreenHook.fullscreenItem &&
        (() => {
          const fullscreenNote = communityNotes.find((n) => n.id === fullscreenHook.fullscreenItem)
          if (!fullscreenNote) return null
          return (
            <Dialog open={true} onOpenChange={() => fullscreenHook.closeFullscreen()}>
              <DialogContent className="max-w-[95vw] xl:max-w-[1600px] w-full h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] p-4 overflow-y-auto">
                <DialogHeader className="sr-only">
                  <DialogTitle>Community Note Details</DialogTitle>
                </DialogHeader>
                <UnifiedNote
                  note={fullscreenNote}
                  mode="fullscreen"
                  windowSize={windowSize}
                  currentUserId={user?.id}
                  readOnly={true}
                  onClose={fullscreenHook.closeFullscreen}
                  onAddReply={handleAddReply}
                  onEditReply={handleEditReply}
                  onDeleteReply={handleDeleteReply}
                  onNoteUpdate={handleNoteUpdateInFullscreen}
                  onDeleteNote={handleDeleteNoteInFullscreen}
                  onUpdateSharing={handleUpdateSharingInFullscreen}
                  onUpdateColor={handleUpdateColorInFullscreen}
                  onTopicChange={handleTopicChangeInFullscreen}
                  onContentChange={handleContentChangeInFullscreen}
                  onDetailsChange={() => {}}
                  onGenerateTags={handleGenerateTagsInFullscreen}
                  hideGenerateTags={true}
                />
              </DialogContent>
            </Dialog>
          )
        })()}

      {user && <SearchStatsDialog open={showStats} onOpenChange={setShowStats} userId={user.id} />}

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}
