"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, UserPlus, BarChart3, CheckCircle2, Circle, Settings, Sparkles, Network } from "lucide-react"
import { NotedIcon } from "@/components/noted/NotedIcon"
import { CreateStickModal } from "@/components/create-stick-modal"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { PermissionBasedStickFullscreen } from "@/components/permission-based/PermissionBasedStickFullscreen"
import { PadInviteModal } from "@/components/pad-invite-modal"
import { UserMenu } from "@/components/user-menu"
import { useRouter, useSearchParams } from "next/navigation"
import { ColorPalette } from "@/components/ColorPalette"
import { StickGanttModal } from "@/components/stick-gantt-modal"
import { StickMapModal } from "@/components/stick-map-modal"
import { PadSettingsDialog } from "@/components/pad-settings-dialog"
import { PadSummaryModal } from "@/components/ai/PadSummaryModal"
import type { Pad, Stick } from "@/types/pad"
import {
  CommunicationPaletteProvider,
  CommunicationModals,
} from "@/components/communication"

// ============================================================================
// Types
// ============================================================================

interface PadPageClientProps {
  pad: Pad
  sticks: Stick[]
  userRole: string | null
}

interface TaskCounts {
  completed: number
  notCompleted: number
  total: number
}

interface StickTaskCounts {
  [stickId: string]: TaskCounts
}

interface InviteData {
  userIds?: string[]
  emails?: string[]
  role: "admin" | "editor" | "viewer"
}

interface GanttState {
  open: boolean
  stickId: string
  stickTopic: string
}

interface MapState {
  open: boolean
  stickId: string
  stickTopic: string
  stickContent: string
  stickColor: string
}

// ============================================================================
// Constants
// ============================================================================

const EDITOR_ROLES = ["admin", "editor", "owner"]
const ADMIN_ROLES = ["admin", "owner"]

const FETCH_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
}

// ============================================================================
// Helpers
// ============================================================================

function hasRole(userRole: string | null, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole || "")
}

function formatInviteResult(summary: { total?: number; success?: unknown[]; failed?: unknown[] }): string {
  const total = summary?.total || 0
  const successCount = summary?.success?.length || 0
  const failedCount = summary?.failed?.length || 0
  return `Successfully sent ${total} invite(s)!\nSuccess: ${successCount}, Failed: ${failedCount}`
}

function buildInvitePayload(padId: string, data: InviteData): object {
  return {
    padId,
    role: data.role,
    ...(data.userIds && { userIds: data.userIds }),
    ...(data.emails && { emails: data.emails }),
  }
}

async function sendPadInvite(padId: string, data: InviteData): Promise<{ success: true; result: any } | { success: false; error: string }> {
  const response = await fetch("/api/pad-invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildInvitePayload(padId, data)),
  })

  const responseText = await response.text()

  let result: any
  try {
    result = JSON.parse(responseText)
  } catch {
    return { success: false, error: "Invalid response from server" }
  }

  if (!response.ok) {
    return { success: false, error: result.error || "Failed to send invite" }
  }

  return { success: true, result }
}

function updateStickColor(sticks: Stick[], stickId: string, color: string): Stick[] {
  return sticks.map((stick) =>
    stick.id === stickId ? { ...stick, color } : stick
  )
}

function revertStickColor(sticks: Stick[], stickId: string, originalSticks: Stick[]): Stick[] {
  const originalColor = originalSticks.find((s) => s.id === stickId)?.color || "#ffffff"
  return updateStickColor(sticks, stickId, originalColor)
}

async function fetchSingleStickTaskCounts(
  stickId: string
): Promise<{ stickId: string; counts: TaskCounts } | null> {
  try {
    const response = await fetch(`/api/sticks/${stickId}/calsticks`, {
      cache: "no-store",
      headers: FETCH_HEADERS,
    })
    if (response.ok) {
      const data = await response.json()
      return { stickId, counts: data.counts }
    }
  } catch (error) {
    console.error(`[PadPageClient] Error fetching task counts for stick ${stickId}:`, error)
  }
  return null
}

async function deleteStickById(stickId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/sticks/${stickId}`, { method: "DELETE" })
    if (!response.ok) {
      return { success: false, error: "Failed to delete stick" }
    }
    return { success: true }
  } catch (error) {
    console.error("[PadPageClient] Error deleting stick:", error)
    return { success: false, error: String(error) }
  }
}

async function updateStickColorOnServer(
  stickId: string,
  color: string
): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`/api/sticks/${stickId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    })
    return { success: response.ok }
  } catch (error) {
    console.error("[PadPageClient] Error updating stick color:", error)
    return { success: false }
  }
}

// ============================================================================
// StickCard Component
// ============================================================================

interface StickCardProps {
  stick: Stick
  counts: TaskCounts | undefined
  canEdit: boolean
  onClick: (stick: Stick) => void
  onOpenGantt: (e: React.MouseEvent, stick: Stick) => void
  onOpenMap: (e: React.MouseEvent, stick: Stick) => void
  onColorChange: (stickId: string, color: string) => void
}

function StickCard({ stick, counts, canEdit, onClick, onOpenGantt, onOpenMap, onColorChange }: Readonly<StickCardProps>) {
  const hasTasks = counts && counts.total > 0

  const handleClick = useCallback(() => {
    onClick(stick)
  }, [onClick, stick])

  const handleGanttClick = useCallback((e: React.MouseEvent) => {
    onOpenGantt(e, stick)
  }, [onOpenGantt, stick])

  const handleMapClick = useCallback((e: React.MouseEvent) => {
    onOpenMap(e, stick)
  }, [onOpenMap, stick])

  const handleColorChange = useCallback((color: string) => {
    onColorChange(stick.id, color)
  }, [onColorChange, stick.id])

  const handleStopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleClick}
      style={{
        borderColor: stick.color || "#ffffff",
        borderWidth: "3px",
        borderStyle: "solid",
      }}
    >
      <CardHeader className="pb-3">
        {stick.topic && <CardTitle className="text-sm font-medium line-clamp-2">{stick.topic}</CardTitle>}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{stick.content}</p>

        {hasTasks && (
          <div className="flex items-center gap-3 mb-3 text-xs">
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              <span>{counts.completed} Completed</span>
            </div>
            <div className="flex items-center gap-1 text-orange-600">
              <Circle className="h-3 w-3" />
              <span>{counts.notCompleted} Not Completed</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {new Date(stick.created_at).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-2">
            <div role="none" onClick={handleStopPropagation} onKeyDown={(e) => e.stopPropagation()}>
              <NotedIcon
                stickId={stick.id}
                stickTopic={stick.topic}
                stickContent={stick.content}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMapClick}
              className="h-8 px-2"
              title="Stick Map"
            >
              <Network className="h-4 w-4" />
            </Button>
            {hasTasks && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGanttClick}
                className="h-8 px-2"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            )}
            <div role="none" onClick={handleStopPropagation} onKeyDown={(e) => e.stopPropagation()}>
              <ColorPalette
                currentColor={stick.color || "#ffffff"}
                onColorChange={handleColorChange}
                size="sm"
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Component
// ============================================================================

export function PadPageClient({ pad, sticks, userRole }: Readonly<PadPageClientProps>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stickParam = searchParams.get("stick")

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  // Stick states
  const [localSticks, setLocalSticks] = useState<Stick[]>(sticks)
  const [selectedStick, setSelectedStick] = useState<Stick | null>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [taskCounts, setTaskCounts] = useState<StickTaskCounts>({})

  // Gantt modal state
  const [ganttState, setGanttState] = useState<GanttState>({
    open: false,
    stickId: "",
    stickTopic: "",
  })

  // Map modal state
  const [mapState, setMapState] = useState<MapState>({
    open: false,
    stickId: "",
    stickTopic: "",
    stickContent: "",
    stickColor: "",
  })

  // Permissions
  const canCreateSticks = hasRole(userRole, EDITOR_ROLES)
  const canInviteUsers = hasRole(userRole, ADMIN_ROLES)

  // Fetch task counts for a single stick
  const fetchStickTaskCounts = useCallback(async (stickId: string): Promise<TaskCounts | null> => {
    try {
      const response = await fetch(`/api/sticks/${stickId}/calsticks?t=${Date.now()}`, {
        cache: "no-store",
        headers: FETCH_HEADERS,
      })
      if (response.ok) {
        const data = await response.json()
        return data.counts
      }
    } catch (error) {
      console.error(`Error fetching task counts for stick ${stickId}:`, error)
    }
    return null
  }, [])

  // Fetch task counts for all sticks
  const fetchAllTaskCounts = useCallback(async (sticksToFetch: Stick[]) => {
    const results = await Promise.all(
      sticksToFetch.map((stick) => fetchSingleStickTaskCounts(stick.id))
    )

    const counts: StickTaskCounts = {}
    for (const result of results) {
      if (result) {
        counts[result.stickId] = result.counts
      }
    }
    setTaskCounts(counts)
  }, [])

  // Refresh task counts for a specific stick
  const refreshStickTaskCounts = useCallback(async (stickId: string) => {
    const counts = await fetchStickTaskCounts(stickId)
    if (counts) {
      setTaskCounts((prev) => ({ ...prev, [stickId]: counts }))
    }
  }, [fetchStickTaskCounts])

  // Process pending invitations
  const processInvitations = useCallback(async () => {
    try {
      const response = await fetch(`/api/pads/${pad.id}/process-invites`, {
        method: "POST",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.processed) {
          globalThis.location.reload()
        }
      }
    } catch (error) {
      console.error("[PadPageClient] Error processing invitations:", error)
    }
  }, [pad.id])

  // Update sticks when props change
  useEffect(() => {
    setLocalSticks(sticks)
    fetchAllTaskCounts(sticks)
  }, [sticks, fetchAllTaskCounts])

  // Process invitations on mount
  useEffect(() => {
    processInvitations()
  }, [processInvitations])

  // Auto-open a stick from ?stick= URL param (e.g. linked from Noted "Go to Stick")
  useEffect(() => {
    if (!stickParam || localSticks.length === 0) return
    const stick = localSticks.find((s) => s.id === stickParam)
    if (stick && !isFullscreenOpen) {
      setSelectedStick(stick)
      setIsFullscreenOpen(true)
    }
  }, [stickParam, localSticks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handleStickClick = useCallback((stick: Stick) => {
    setSelectedStick(stick)
    setIsFullscreenOpen(true)
  }, [])

  const handleOpenGantt = useCallback((e: React.MouseEvent, stick: Stick) => {
    e.stopPropagation()
    setGanttState({
      open: true,
      stickId: stick.id,
      stickTopic: stick.topic || "",
    })
  }, [])

  const handleCloseGantt = useCallback((open: boolean) => {
    setGanttState((prev) => ({ ...prev, open }))
  }, [])

  const handleOpenMap = useCallback((e: React.MouseEvent, stick: Stick) => {
    e.stopPropagation()
    setMapState({
      open: true,
      stickId: stick.id,
      stickTopic: stick.topic || "",
      stickContent: stick.content || "",
      stickColor: stick.color || "",
    })
  }, [])

  const handleCloseMap = useCallback((open: boolean) => {
    setMapState((prev) => ({ ...prev, open }))
  }, [])

  const handleMapNodeClick = useCallback(async (nodeId: string, data?: { chatId?: string; meetingId?: string }) => {
    // Close the map modal
    setMapState((prev) => ({ ...prev, open: false }))

    const stickId = mapState.stickId

    // Noted: look up the noted page for this stick, then navigate
    if (nodeId === "noted") {
      try {
        const res = await fetch(`/api/noted/pages/by-stick/${stickId}`)
        const json = await res.json()
        if (json.exists && json.data?.id) {
          router.push(`/noted?page=${json.data.id}`)
        }
      } catch (err) {
        console.error("Error navigating to noted page:", err)
      }
      return
    }

    // Chat: navigate to the chat room
    if (nodeId === "chats" && data?.chatId) {
      router.push(`/chats/${data.chatId}`)
      return
    }

    // Video: navigate to video page
    if (nodeId === "videoRooms") {
      router.push("/video")
      return
    }

    // Default: open the stick in fullscreen (e.g. CalSticks)
    const stick = localSticks.find((s) => s.id === stickId)
    if (stick) {
      setSelectedStick(stick)
      setIsFullscreenOpen(true)
    }
  }, [localSticks, mapState.stickId, router])

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true)
  }, [])

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false)
  }, [])

  const handleOpenInviteModal = useCallback(() => {
    setShowInviteModal(true)
  }, [])

  const handleOpenSettingsDialog = useCallback(() => {
    setShowSettingsDialog(true)
  }, [])

  const handleCloseFullscreen = useCallback(async () => {
    if (selectedStick) {
      await refreshStickTaskCounts(selectedStick.id)
    }

    setIsFullscreenOpen(false)
    setSelectedStick(null)
    router.refresh()
  }, [selectedStick, refreshStickTaskCounts, router])

  const handleUpdateStick = useCallback(async (updatedStick: Stick) => {
    setSelectedStick(updatedStick)
    setLocalSticks((prevSticks) =>
      prevSticks.map((stick) => (stick.id === updatedStick.id ? updatedStick : stick))
    )
    await refreshStickTaskCounts(updatedStick.id)
  }, [refreshStickTaskCounts])

  const handleDeleteStick = useCallback(async (stickId: string) => {
    const result = await deleteStickById(stickId)

    if (result.success) {
      setIsFullscreenOpen(false)
      setSelectedStick(null)
      router.refresh()
    }
  }, [router])

  const handleStickColorChange = useCallback(async (stickId: string, color: string) => {
    // Optimistic update
    setLocalSticks((prevSticks) => updateStickColor(prevSticks, stickId, color))

    const result = await updateStickColorOnServer(stickId, color)

    if (!result.success) {
      // Revert on error
      setLocalSticks((prevSticks) => revertStickColor(prevSticks, stickId, sticks))
    }
  }, [sticks])

  const submitPadInvite = useCallback(async (data: InviteData): Promise<void> => {
    try {
      const result = await sendPadInvite(pad.id, data)

      if (!result.success) {
        throw new Error(result.error)
      }

      alert(formatInviteResult(result.result.summary))
      setShowInviteModal(false)
      router.refresh()
    } catch (err) {
      console.error("[PadPageClient] Pad invite error:", err)
      alert(`Failed to send invite: ${err instanceof Error ? err.message : "Unknown error"}`)
      throw err
    }
  }, [pad.id, router])

  // Computed permissions for fullscreen
  const fullscreenPermissions = {
    canView: true,
    canEdit: canCreateSticks,
    canAdmin: canInviteUsers,
  }

  return (
    <CommunicationPaletteProvider padId={pad.id} padName={pad.name}>
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          {/* Top row: Breadcrumb (User Menu on desktop only) */}
          <div className="flex items-center justify-between">
            <BreadcrumbNav
              items={[
                { label: "Dashboard", href: "/Dashboard" },
                { label: "Paks-Hub", href: "/paks" },
                { label: "My Pads", href: "/mypads" },
                { label: pad.name, current: true },
              ]}
            />
            <div className="hidden sm:block">
              <UserMenu hideSettings={true} />
            </div>
          </div>

          {/* Title and description */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold">{pad.name}</h1>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {userRole}
              </Badge>
            </div>
            {pad.description && <p className="text-muted-foreground mt-2">{pad.description}</p>}
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-2 flex-wrap">
            <PadSummaryModal
              padId={pad.id}
              padName={pad.name}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 sm:gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 bg-transparent"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Smart Summary</span>
                </Button>
              }
            />
            {canCreateSticks && (
              <Button size="sm" onClick={handleOpenCreateModal}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Create Sticks</span>
              </Button>
            )}
            {canInviteUsers && (
              <Button variant="outline" size="sm" onClick={handleOpenInviteModal}>
                <UserPlus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Pad Invite</span>
              </Button>
            )}
            {canInviteUsers && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleOpenSettingsDialog}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {/* User Menu on mobile - at end of action buttons */}
            <div className="sm:hidden ml-auto">
              <UserMenu hideSettings={true} />
            </div>
          </div>
        </div>

        {/* Sticks Grid */}
        <div className="grid gap-4">
          {localSticks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">No Sticks yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first Stick to get started with this Pad.</p>
                  {canCreateSticks && (
                    <Button onClick={handleOpenCreateModal}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Stick
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localSticks.map((stick) => (
                <StickCard
                  key={stick.id}
                  stick={stick}
                  counts={taskCounts[stick.id]}
                  canEdit={canCreateSticks}
                  onClick={handleStickClick}
                  onOpenGantt={handleOpenGantt}
                  onOpenMap={handleOpenMap}
                  onColorChange={handleStickColorChange}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        <CreateStickModal isOpen={isCreateModalOpen} onClose={handleCloseCreateModal} padId={pad.id} />

        <PadInviteModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          padId={pad.id}
          onInviteSubmit={submitPadInvite}
        />

        <StickGanttModal
          open={ganttState.open}
          onOpenChange={handleCloseGantt}
          stickId={ganttState.stickId}
          stickTopic={ganttState.stickTopic}
        />

        <StickMapModal
          open={mapState.open}
          onOpenChange={handleCloseMap}
          stickId={mapState.stickId}
          stickTopic={mapState.stickTopic}
          stickContent={mapState.stickContent}
          stickColor={mapState.stickColor}
          onNodeClick={handleMapNodeClick}
        />

        <PadSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          padId={pad.id}
          padName={pad.name}
          userRole={userRole}
        />

        {selectedStick && isFullscreenOpen && (
          <PermissionBasedStickFullscreen
            stick={selectedStick}
            permissions={fullscreenPermissions}
            onClose={handleCloseFullscreen}
            onUpdate={handleUpdateStick}
            onDelete={handleDeleteStick}
          />
        )}
      </div>

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}
