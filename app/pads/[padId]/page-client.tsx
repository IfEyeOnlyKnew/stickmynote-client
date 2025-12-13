"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, UserPlus, BarChart3, CheckCircle2, Circle, Settings, Sparkles } from "lucide-react"
import { CreateStickModal } from "@/components/create-stick-modal"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { PermissionBasedStickFullscreen } from "@/components/permission-based/PermissionBasedStickFullscreen"
import { PadInviteModal } from "@/components/pad-invite-modal"
import { UserMenu } from "@/components/user-menu"
import { useRouter } from "next/navigation"
import { ColorPalette } from "@/components/ColorPalette"
import { StickGanttModal } from "@/components/stick-gantt-modal"
import { PadSettingsDialog } from "@/components/pad-settings-dialog"
import { PadSummaryModal } from "@/components/ai/PadSummaryModal"
import type { Pad, Stick } from "@/types/pad"

interface PadPageClientProps {
  pad: Pad
  sticks: Stick[]
  userRole: string | null
}

interface StickTaskCounts {
  [stickId: string]: {
    completed: number
    notCompleted: number
    total: number
  }
}

export function PadPageClient({ pad, sticks, userRole }: PadPageClientProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedStick, setSelectedStick] = useState<Stick | null>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [localSticks, setLocalSticks] = useState<Stick[]>(sticks)
  const [ganttModalOpen, setGanttModalOpen] = useState(false)
  const [ganttStickId, setGanttStickId] = useState<string>("")
  const [ganttStickTopic, setGanttStickTopic] = useState<string>("")
  const [taskCounts, setTaskCounts] = useState<StickTaskCounts>({})
  const router = useRouter()

  useEffect(() => {
    setLocalSticks(sticks)
    fetchAllTaskCounts()
  }, [sticks])

  useEffect(() => {
    const processInvitations = async () => {
      try {
        console.log("[v0] Checking for pending pad invitations...")
        const response = await fetch(`/api/pads/${pad.id}/process-invites`, {
          method: "POST",
        })

        if (response.ok) {
          const data = await response.json()
          console.log("[v0] Invitation processing result:", data)
          if (data.processed) {
            console.log("[v0] Pad invitation processed successfully, reloading page...")
            window.location.reload()
          }
        } else {
          console.error("[v0] Failed to process invitations:", await response.text())
        }
      } catch (error) {
        console.error("[v0] Error processing invitations:", error)
      }
    }

    processInvitations()
  }, [pad.id])

  const fetchAllTaskCounts = async () => {
    const counts: StickTaskCounts = {}
    await Promise.all(
      sticks.map(async (stick) => {
        try {
          const response = await fetch(`/api/sticks/${stick.id}/calsticks`, {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          })
          if (response.ok) {
            const data = await response.json()
            counts[stick.id] = data.counts
          }
        } catch (error) {
          console.error(`Error fetching task counts for stick ${stick.id}:`, error)
        }
      }),
    )
    setTaskCounts(counts)
  }

  const refreshStickTaskCounts = async (stickId: string) => {
    try {
      const response = await fetch(`/api/sticks/${stickId}/calsticks?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      })
      if (response.ok) {
        const data = await response.json()
        setTaskCounts((prev) => ({
          ...prev,
          [stickId]: data.counts,
        }))
      }
    } catch (error) {
      console.error(`Error refreshing task counts for stick ${stickId}:`, error)
    }
  }

  const canCreateSticks = ["admin", "editor", "owner"].includes(userRole || "")
  const canInviteUsers = ["admin", "owner"].includes(userRole || "")

  const handleStickClick = (stick: Stick) => {
    setSelectedStick(stick)
    setIsFullscreenOpen(true)
  }

  const handleOpenGantt = (e: React.MouseEvent, stick: Stick) => {
    e.stopPropagation()
    setGanttStickId(stick.id)
    setGanttStickTopic(stick.topic || "")
    setGanttModalOpen(true)
  }

  const handleCloseFullscreen = async () => {
    // Refresh task counts for the stick that was just edited
    if (selectedStick) {
      await refreshStickTaskCounts(selectedStick.id)
    }

    setIsFullscreenOpen(false)
    setSelectedStick(null)

    // Refresh the page to ensure all data is up to date
    router.refresh()
  }

  const handleUpdateStick = async (updatedStick: Stick) => {
    console.log("[v0] handleUpdateStick called with:", updatedStick)

    // Update the selected stick to keep fullscreen open with latest data
    setSelectedStick(updatedStick)

    // Update the local sticks array
    setLocalSticks((prevSticks) => prevSticks.map((stick) => (stick.id === updatedStick.id ? updatedStick : stick)))

    await refreshStickTaskCounts(updatedStick.id)
  }

  const handleDeleteStick = async (stickId: string) => {
    try {
      const response = await fetch(`/api/sticks/${stickId}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete stick")
      handleCloseFullscreen()
      router.refresh()
    } catch (error) {
      console.error("Error deleting stick:", error)
    }
  }

  const submitPadInvite = async (data: {
    userIds?: string[]
    emails?: string[]
    role: "admin" | "editor" | "viewer"
  }): Promise<void> => {
    try {
      console.log("[v0] ===== SUBMITTING PAD INVITE =====")
      console.log("[v0] Data received:", JSON.stringify(data, null, 2))
      console.log("[v0] Pad ID:", pad.id)
      console.log("[v0] User role:", userRole)

      const inviteData = {
        padId: pad.id,
        role: data.role,
        ...(data.userIds ? { userIds: data.userIds } : {}),
        ...(data.emails ? { emails: data.emails } : {}),
      }

      console.log("[v0] Final invite data being sent:", JSON.stringify(inviteData, null, 2))

      const response = await fetch("/api/pad-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteData),
      })

      console.log("[v0] API response status:", response.status)
      console.log("[v0] API response ok:", response.ok)
      console.log("[v0] API response headers:", Object.fromEntries(response.headers.entries()))

      const responseText = await response.text()
      console.log("[v0] API response body (raw):", responseText)

      let result
      try {
        result = JSON.parse(responseText)
        console.log("[v0] API response body (parsed):", result)
      } catch (parseError) {
        console.error("[v0] Failed to parse response as JSON:", parseError)
        throw new Error("Invalid response from server")
      }

      if (!response.ok) {
        console.error("[v0] API error response:", result)
        throw new Error(result.error || "Failed to send invite")
      }

      console.log("[v0] Pad invite successful!")
      console.log("[v0] Summary:", result.summary)

      alert(
        `Successfully sent ${result.summary?.total || 0} invite(s)!\nSuccess: ${result.summary?.success?.length || 0}, Failed: ${result.summary?.failed?.length || 0}`,
      )
      setShowInviteModal(false)

      // Refresh the page to show updated member list
      router.refresh()
    } catch (err) {
      console.error("[v0] Pad invite error:", err)
      alert(`Failed to send invite: ${err instanceof Error ? err.message : "Unknown error"}`)
      throw err
    }
  }

  const handleStickColorChange = async (stickId: string, color: string) => {
    console.log("[v0] Updating stick color:", { stickId, color })

    setLocalSticks((prevSticks) => prevSticks.map((stick) => (stick.id === stickId ? { ...stick, color } : stick)))

    try {
      const response = await fetch(`/api/sticks/${stickId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      })

      if (!response.ok) {
        console.error("[v0] Failed to update stick color, reverting local state")
        setLocalSticks((prevSticks) =>
          prevSticks.map((stick) =>
            stick.id === stickId
              ? { ...stick, color: sticks.find((s) => s.id === stickId)?.color || "#ffffff" }
              : stick,
          ),
        )
        throw new Error("Failed to update stick color")
      }

      const result = await response.json()
      console.log("[v0] Stick color updated successfully:", result)
    } catch (error) {
      console.error("Error updating stick color:", error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="mb-4">
              <BreadcrumbNav
                items={[
                  {
                    label: "Dashboard",
                    href: "/Dashboard",
                  },
                  {
                    label: "Paks-Hub",
                    href: "/paks",
                  },
                  {
                    label: "My Pads",
                    href: "/mypads",
                  },
                  {
                    label: pad.name,
                    current: true,
                  },
                ]}
              />
            </div>
            <h1 className="text-3xl font-bold">{pad.name}</h1>
            {pad.description && <p className="text-muted-foreground mt-2">{pad.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {userRole}
            </Badge>
            <PadSummaryModal
              padId={pad.id}
              padName={pad.name}
              trigger={
                <Button
                  variant="outline"
                  className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 bg-transparent"
                >
                  <Sparkles className="h-4 w-4" />
                  Smart Summary
                </Button>
              }
            />
            {canCreateSticks && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Sticks
              </Button>
            )}
            {canInviteUsers && (
              <Button variant="outline" onClick={() => setShowInviteModal(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Pad Invite
              </Button>
            )}
            {canInviteUsers && (
              <Button variant="outline" size="icon" onClick={() => setShowSettingsDialog(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <UserMenu hideSettings={true} />
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
                    <Button onClick={() => setIsCreateModalOpen(true)}>
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
                <Card
                  key={stick.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleStickClick(stick)}
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

                    {taskCounts[stick.id] && taskCounts[stick.id].total > 0 && (
                      <div className="flex items-center gap-3 mb-3 text-xs">
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{taskCounts[stick.id].completed} Completed</span>
                        </div>
                        <div className="flex items-center gap-1 text-orange-600">
                          <Circle className="h-3 w-3" />
                          <span>{taskCounts[stick.id].notCompleted} Not Completed</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {new Date(stick.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        {taskCounts[stick.id] && taskCounts[stick.id].total > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleOpenGantt(e, stick)}
                            className="h-8 px-2"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        )}
                        <div onClick={(e) => e.stopPropagation()}>
                          <ColorPalette
                            currentColor={stick.color || "#ffffff"}
                            onColorChange={(color) => handleStickColorChange(stick.id, color)}
                            size="sm"
                            disabled={!canCreateSticks}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Create Stick Modal */}
        <CreateStickModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} padId={pad.id} />

        {/* Pad Invite Modal */}
        <PadInviteModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          padId={pad.id}
          onInviteSubmit={submitPadInvite}
        />

        <StickGanttModal
          open={ganttModalOpen}
          onOpenChange={setGanttModalOpen}
          stickId={ganttStickId}
          stickTopic={ganttStickTopic}
        />

        {/* Pad Settings Dialog */}
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
            permissions={{
              canView: true,
              canEdit: ["admin", "editor", "owner"].includes(userRole || ""),
              canAdmin: ["admin", "owner"].includes(userRole || ""),
            }}
            onClose={handleCloseFullscreen}
            onUpdate={handleUpdateStick}
            onDelete={handleDeleteStick}
          />
        )}
      </div>
    </div>
  )
}
