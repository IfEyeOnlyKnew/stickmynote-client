"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Zap, MessagesSquare, Video } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { PermissionBasedStickFullscreen } from "@/components/permission-based/PermissionBasedStickFullscreen"
import { NotedIcon } from "@/components/noted/NotedIcon"
import { StickMapButton } from "@/components/stick-map/StickMapButton"
import { SubStickMenuButton } from "@/components/SubStickMenuButton"
import { CreateStickModal } from "@/components/create-stick-modal"
import { CreateChatModal } from "@/components/stick-chats/CreateChatModal"
import type { Stick } from "@/types/pad"

// ============================================================================
// Types
// ============================================================================

interface PadInfo {
  id: string
  name: string
  owner_id: string
}

interface QuickStick extends Stick {
  pads: PadInfo
}

interface QuickSticksPageClientProps {
  user: {
    id: string
    email?: string
  }
}

interface QuickSticksState {
  sticks: QuickStick[]
  subSticks: QuickStick[]
  loading: boolean
  searchQuery: string
  debouncedSearch: string
}

interface FullscreenState {
  selectedStick: QuickStick | null
  isOpen: boolean
}

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[QuickSticks]"
const DEBOUNCE_DELAY_MS = 300

const BREADCRUMB_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Alliance Hub", href: "/paks" },
  { label: "QuickSticks", current: true },
]

const FULL_PERMISSIONS = {
  canView: true,
  canEdit: true,
  canAdmin: true,
}

// ============================================================================
// Helpers
// ============================================================================

function buildApiUrl(search: string): string {
  const base = "/api/quicksticks"
  return search ? `${base}?search=${encodeURIComponent(search)}` : base
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

// ============================================================================
// StickCard Component
// ============================================================================

interface StickCardProps {
  stick: QuickStick
  onClick: (stick: QuickStick) => void
  isSubStick?: boolean
  hasSubSticks?: boolean
  isShowingSubSticks?: boolean
  onChatClick: (e: React.MouseEvent, stick: QuickStick) => void
  onVideoClick: (e: React.MouseEvent) => void
  onCreateSubStick?: (stick: QuickStick) => void
  onToggleShowSubSticks?: () => void
}

function StickCard({
  stick,
  onClick,
  isSubStick = false,
  hasSubSticks = false,
  isShowingSubSticks = false,
  onChatClick,
  onVideoClick,
  onCreateSubStick,
  onToggleShowSubSticks,
}: Readonly<StickCardProps>) {
  const handleClick = useCallback(() => {
    onClick(stick)
  }, [onClick, stick])

  const handleStopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  // Sub-sticks get a thicker left stripe in their own (parent-inherited)
  // color; top-level cards use the original 4px visual.
  const borderLeftWidth = isSubStick ? "8px" : "4px"

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      style={{ borderLeft: `${borderLeftWidth} solid ${stick.color}` }}
      onClick={handleClick}
    >
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-lg">
          <span className="line-clamp-2 flex-1">{stick.topic || "Untitled Stick"}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span onClick={handleStopPropagation} onKeyDown={(e) => e.stopPropagation()} role="none">
              <NotedIcon
                stickId={stick.id}
                stickTopic={stick.topic}
                stickContent={stick.content}
                size="sm"
                openInNewTab
              />
            </span>
            <span onClick={handleStopPropagation} onKeyDown={(e) => e.stopPropagation()} role="none">
              <StickMapButton
                stickId={stick.id}
                stickTopic={stick.topic}
                stickContent={stick.content}
                stickColor={stick.color}
                className="h-7 w-7 p-0"
              />
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => onChatClick(e, stick)}
              title="New chat"
            >
              <MessagesSquare className="h-4 w-4 text-purple-500 hover:text-purple-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onVideoClick}
              title="Start video call"
            >
              <Video className="h-4 w-4 text-blue-500 hover:text-blue-600" />
            </Button>
            {!isSubStick && onCreateSubStick && (
              <span onClick={handleStopPropagation} onKeyDown={(e) => e.stopPropagation()} role="none">
                <SubStickMenuButton
                  hasSubSticks={hasSubSticks}
                  isShowingSubSticks={isShowingSubSticks}
                  onCreateSubStick={() => onCreateSubStick(stick)}
                  onToggleShowSubSticks={onToggleShowSubSticks}
                  indicatorColor={stick.color}
                />
              </span>
            )}
          </div>
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-xs">
            {stick.pads.name}
          </Badge>
          {!isSubStick && (
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              QuickStick
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 line-clamp-3">{stick.content}</p>
        <p className="text-xs text-gray-400 mt-2">
          Updated {formatDate(stick.updated_at)}
        </p>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Component
// ============================================================================

export function QuickSticksPageClient({ user }: Readonly<QuickSticksPageClientProps>) {
  // State
  const [state, setState] = useState<QuickSticksState>({
    sticks: [],
    subSticks: [],
    loading: true,
    searchQuery: "",
    debouncedSearch: "",
  })

  const [fullscreenState, setFullscreenState] = useState<FullscreenState>({
    selectedStick: null,
    isOpen: false,
  })

  const [showSubSticks, setShowSubSticks] = useState(false)
  const [subStickParent, setSubStickParent] = useState<QuickStick | null>(null)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatStickTopic, setChatStickTopic] = useState("")

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, debouncedSearch: prev.searchQuery }))
    }, DEBOUNCE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [state.searchQuery])

  // Fetch QuickSticks
  const fetchQuickSticks = useCallback(async (search: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true }))

      const url = buildApiUrl(search)
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch QuickSticks")
      }

      const data = await response.json()
      setState((prev) => ({
        ...prev,
        sticks: data.sticks || [],
        subSticks: data.subSticks || [],
        loading: false,
      }))
    } catch (error) {
      console.error(`${LOG_PREFIX} Error fetching:`, error)
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    fetchQuickSticks(state.debouncedSearch)
  }, [state.debouncedSearch, fetchQuickSticks])

  // Handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, searchQuery: e.target.value }))
  }, [])

  const handleStickClick = useCallback((stick: QuickStick) => {
    setFullscreenState({ selectedStick: stick, isOpen: true })
  }, [])

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenState({ selectedStick: null, isOpen: false })
  }, [])

  const handleUpdateStick = useCallback((updatedStick: Stick) => {
    setState((prev) => ({
      ...prev,
      sticks: prev.sticks.map((stick) =>
        stick.id === updatedStick.id
          ? { ...updatedStick, pads: stick.pads }
          : stick
      ),
    }))
  }, [])

  const handleDeleteStick = useCallback((stickId: string) => {
    setState((prev) => ({
      ...prev,
      sticks: prev.sticks.filter((stick) => stick.id !== stickId),
      subSticks: prev.subSticks.filter((stick) => stick.id !== stickId),
    }))
    handleCloseFullscreen()
  }, [handleCloseFullscreen])

  const handleChatClick = useCallback((e: React.MouseEvent, stick: QuickStick) => {
    e.stopPropagation()
    setChatStickTopic(stick.topic || "Untitled Stick")
    setChatModalOpen(true)
  }, [])

  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    window.open("/video", "_blank", "noopener,noreferrer")
  }, [])

  const handleCreateSubStick = useCallback((stick: QuickStick) => {
    setSubStickParent(stick)
  }, [])

  const handleToggleShowSubSticks = useCallback(() => {
    setShowSubSticks((prev) => !prev)
  }, [])

  const handleCloseSubStickModal = useCallback(() => {
    setSubStickParent(null)
    // Refetch so the new sub-stick shows up in the feed immediately.
    fetchQuickSticks(state.debouncedSearch)
  }, [fetchQuickSticks, state.debouncedSearch])

  // Group sub-sticks by their parent id for fast lookup during render.
  const subSticksByParent = useMemo(() => {
    const map = new Map<string, QuickStick[]>()
    for (const s of state.subSticks) {
      if (!s.parent_stick_id) continue
      const arr = map.get(s.parent_stick_id) ?? []
      arr.push(s)
      map.set(s.parent_stick_id, arr)
    }
    return map
  }, [state.subSticks])

  const displaySticks = useMemo(() => {
    if (!showSubSticks) return state.sticks
    const result: QuickStick[] = []
    for (const parent of state.sticks) {
      const children = subSticksByParent.get(parent.id)
      if (!children || children.length === 0) continue
      result.push(parent, ...children)
    }
    return result
  }, [showSubSticks, state.sticks, subSticksByParent])

  // Derived state
  const hasSticks = state.sticks.length > 0
  const showEmptyState = !state.loading && !hasSticks

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <BreadcrumbNav items={BREADCRUMB_ITEMS} />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Zap className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">QuickSticks</h1>
            <p className="text-gray-600">Quick access to your important sticks</p>
          </div>
        </div>
        <UserMenu />
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search QuickSticks by topic or content..."
            value={state.searchQuery}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
      </div>

      {/* Loading State */}
      {state.loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      )}

      {/* Empty State */}
      {showEmptyState && (
        <Card className="text-center py-12">
          <CardContent>
            <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No QuickSticks Found</h3>
            <p className="text-gray-600">
              {state.searchQuery
                ? "No sticks match your search. Try a different query."
                : "Mark sticks as QuickSticks to see them here for quick access."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Show Sub Sticks banner */}
      {showSubSticks && !state.loading && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
          <span className="text-sm font-medium text-amber-900">Showing Sub Sticks</span>
          <span className="text-xs text-amber-700">— families only</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSubSticks(false)}
            className="h-6 ml-auto text-xs text-amber-900 hover:bg-amber-100"
          >
            Show All Sticks
          </Button>
        </div>
      )}

      {/* Sticks Grid */}
      {!state.loading && hasSticks && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displaySticks.map((stick) => {
            const isSubStick = Boolean(stick.parent_stick_id)
            const hasSubSticks = !isSubStick && (subSticksByParent.get(stick.id)?.length ?? 0) > 0
            return (
              <Fragment key={stick.id}>
                <StickCard
                  stick={stick}
                  onClick={handleStickClick}
                  isSubStick={isSubStick}
                  hasSubSticks={hasSubSticks}
                  isShowingSubSticks={showSubSticks}
                  onChatClick={handleChatClick}
                  onVideoClick={handleVideoClick}
                  onCreateSubStick={isSubStick ? undefined : handleCreateSubStick}
                  onToggleShowSubSticks={handleToggleShowSubSticks}
                />
              </Fragment>
            )
          })}
        </div>
      )}

      {/* Empty state when families mode has nothing to show */}
      {!state.loading && hasSticks && showSubSticks && displaySticks.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-500">
          No QuickSticks have sub sticks yet.
        </div>
      )}

      {/* Fullscreen Modal Component */}
      {fullscreenState.selectedStick && fullscreenState.isOpen && (
        <PermissionBasedStickFullscreen
          stick={fullscreenState.selectedStick}
          permissions={FULL_PERMISSIONS}
          onClose={handleCloseFullscreen}
          onUpdate={handleUpdateStick}
          onDelete={handleDeleteStick}
          stickType="personal"
        />
      )}

      {/* Sub-stick create modal (reuses the pad create modal in sub-stick mode) */}
      {subStickParent?.pads?.id && (
        <CreateStickModal
          isOpen={subStickParent !== null}
          onClose={handleCloseSubStickModal}
          padId={subStickParent.pads.id}
          parentStickId={subStickParent.id}
          parentColor={subStickParent.color}
        />
      )}

      {/* Chat Modal */}
      <CreateChatModal
        open={chatModalOpen}
        onOpenChange={setChatModalOpen}
        defaultName={chatStickTopic}
        autoSubmit
        openInNewTab
      />
    </div>
  )
}
