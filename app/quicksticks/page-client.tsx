"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Zap } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { PermissionBasedStickFullscreen } from "@/components/permission-based/PermissionBasedStickFullscreen"
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
}

function StickCard({ stick, onClick }: Readonly<StickCardProps>) {
  const handleClick = useCallback(() => {
    onClick(stick)
  }, [onClick, stick])

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      style={{ borderLeft: `4px solid ${stick.color}` }}
      onClick={handleClick}
    >
      <CardHeader>
        <CardTitle className="text-lg line-clamp-2">
          {stick.topic || "Untitled Stick"}
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-xs">
            {stick.pads.name}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            QuickStick
          </Badge>
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
    loading: true,
    searchQuery: "",
    debouncedSearch: "",
  })

  const [fullscreenState, setFullscreenState] = useState<FullscreenState>({
    selectedStick: null,
    isOpen: false,
  })

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
    }))
    handleCloseFullscreen()
  }, [handleCloseFullscreen])

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

      {/* Sticks Grid */}
      {!state.loading && hasSticks && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {state.sticks.map((stick) => (
            <StickCard
              key={stick.id}
              stick={stick}
              onClick={handleStickClick}
            />
          ))}
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
        />
      )}
    </div>
  )
}
