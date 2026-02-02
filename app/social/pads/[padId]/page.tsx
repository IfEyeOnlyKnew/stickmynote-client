"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { ManageMembersDialog } from "@/components/social/manage-members-dialog"
import { PadSettingsDialog } from "@/components/social/pad-settings-dialog"
import { CreateStickModal } from "@/components/create-stick-modal"
import { ManageStickMembersDialog } from "@/components/social/manage-stick-members-dialog"
import { StickDetailModal } from "@/components/social/stick-detail-modal"
import {
  Users,
  Settings,
  Globe,
  Lock,
  FileText,
  Clock,
  Heart,
  MessageCircle,
  MessagesSquare,
  Video,
  Sparkles,
  Plus,
  Pin,
  PinOff,
  BarChart3,
  Calendar,
} from "lucide-react"
import { CreateChatModal } from "@/components/stick-chats/CreateChatModal"
import { PadChatPanel } from "@/components/social/pad-chat-panel"
import { PadPresenceIndicator } from "@/components/social/pad-presence-indicator"
import {
  CommunicationPaletteProvider,
  CommunicationModals,
  useCommunicationPaletteContextSafe,
} from "@/components/communication"

interface SocialPad {
  id: string
  name: string
  description: string
  owner_id: string
  created_at: string
  is_public: boolean
  access_mode?: string
  social_pad_members?: Array<{ count: number }>
  profiles?: { email: string; full_name: string | null }
}

interface SocialStick {
  id: string
  topic: string
  content: string
  social_pad_id: string
  user_id: string
  created_at: string
  color: string
  is_pinned?: boolean
  pin_order?: number
  pinned_at?: string
  pinned_by?: string
  profiles?: { email: string; full_name: string | null }
  social_stick_replies?: Array<{ count: number }>
  reaction_counts?: Record<string, number>
}

// Schedule Meeting Button - uses communication palette context
function ScheduleMeetingButton({
  stickId,
  stickTopic,
  onClick,
}: {
  stickId: string
  stickTopic: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const paletteContext = useCommunicationPaletteContextSafe()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onClick?.(e)

    if (paletteContext) {
      // Update context with stick info
      paletteContext.updateContext({ stickId, stickTopic })
      // Open the schedule meeting modal
      paletteContext.openModal("schedule-meeting")
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={handleClick}
      title="Schedule meeting"
    >
      <Calendar className="h-4 w-4 text-purple-500 hover:text-purple-600" />
    </Button>
  )
}

export default function SocialPadPage({ params }: Readonly<{ params: { padId: string } }>) {
  const { user, loading } = useUser()
  const router = useRouter()
  const padId = params.padId

  const [pad, setPad] = useState<SocialPad | null>(null)
  const [sticks, setSticks] = useState<SocialStick[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [manageMembersOpen, setManageMembersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createStickOpen, setCreateStickOpen] = useState(false)
  const [manageStickMembersOpen, setManageStickMembersOpen] = useState(false)
  const [selectedStickId, setSelectedStickId] = useState<string | null>(null)
  const [selectedStick, setSelectedStick] = useState<{ id: string; topic: string } | null>(null)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatStickTopic, setChatStickTopic] = useState("")
  const [showPadChat, setShowPadChat] = useState(false)
  const [padChatCollapsed, setPadChatCollapsed] = useState(false)
  const [padMembers, setPadMembers] = useState<Array<{ user_id: string; role?: string; user?: any }>>([])


  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const processPendingInvites = async () => {
      if (!padId || !user) return

      try {
        console.log("[v0] Checking for pending invites to process")
        const response = await fetch(`/api/social-pads/${padId}/process-pending-invites`, {
          method: "POST",
        })
        const data = await response.json()
        console.log("[v0] Processed pending invites:", data)

        // If invites were processed, refresh the pad data
        if (data.results?.some((r: any) => r.status === "processed")) {
          console.log("[v0] Invites were processed, refreshing pad data")
          fetchPadData()
        }
      } catch (error) {
        console.error("[v0] Error processing pending invites:", error)
      }
    }

    if (padId && user) {
      processPendingInvites()
    }
  }, [padId, user])
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (padId) {
      fetchPadData()
    }
  }, [padId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchPadData = async () => {
    try {
      setLoadingData(true)
      const response = await fetch(`/api/social-pads/${padId}`)

      if (response.status === 401) {
        router.push(`/auth/login?redirectTo=/social/pads/${padId}`)
        return
      }

      if (response.status === 403) {
        router.push("/social")
        return
      }

      if (response.ok) {
        const data = await response.json()
        setPad(data.pad)
        const sticksWithReactions = await Promise.all(
          (data.sticks || []).map(async (stick: SocialStick) => {
            try {
              const reactionsRes = await fetch(`/api/social-sticks/${stick.id}/reactions`)
              if (reactionsRes.ok) {
                const reactionsData = await reactionsRes.json()
                return {
                  ...stick,
                  reaction_counts: reactionsData.reactionCounts || {},
                }
              }
            } catch (err) {
              console.error(`Error fetching reactions for stick ${stick.id}:`, err)
            }
            return stick
          }),
        )
        setSticks(sticksWithReactions)
      } else {
        router.push("/social")
      }
    } catch (error) {
      console.error("Error fetching pad data:", error)
      router.push("/social")
    } finally {
      setLoadingData(false)
    }
  }

  const fetchUserRole = async () => {
    if (!user || !padId) return

    try {
      const response = await fetch(`/api/social-pads/${padId}/members`)
      if (response.ok) {
        const data = await response.json()
        const member = data.members?.find((m: any) => m.user_id === user.id)
        setUserRole(member?.role || null)
        // Store all members for presence indicator
        setPadMembers(data.members || [])
      }
    } catch (error) {
      console.error("Error fetching user role:", error)
    }
  }

  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetchUserRole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, padId])

  const isOwner = user && pad && pad.owner_id === user.id

  const handleStickCreated = () => {
    setCreateStickOpen(false)
    fetchPadData()
  }

  const isAdmin = userRole === "admin"
  const canManageSticks = isOwner || isAdmin
  const isViewer = userRole === "viewer"
  const canAddSticks = !isViewer

  const handlePinToggle = async (e: React.MouseEvent, stickId: string) => {
    e.stopPropagation()
    e.preventDefault()

    // Optimistically update the UI
    setSticks((prevSticks) =>
      prevSticks.map((stick) => (stick.id === stickId ? { ...stick, is_pinned: !stick.is_pinned } : stick)),
    )

    try {
      const response = await fetch(`/api/social-sticks/${stickId}/pin`, {
        method: "POST",
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setSticks((prevSticks) =>
          prevSticks.map((stick) => (stick.id === stickId ? { ...stick, is_pinned: !stick.is_pinned } : stick)),
        )
        const data = await response.json()
        alert(data.error || "Failed to pin/unpin stick")
      }
    } catch (error) {
      // Revert optimistic update on error
      setSticks((prevSticks) =>
        prevSticks.map((stick) => (stick.id === stickId ? { ...stick, is_pinned: !stick.is_pinned } : stick)),
      )
      console.error("Error toggling pin:", error)
      alert("An error occurred while pinning/unpinning the stick")
    }
  }

  const handleManageStickMembers = (e: React.MouseEvent, stick: SocialStick) => {
    e.stopPropagation()
    setSelectedStick({ id: stick.id, topic: stick.topic })
    setManageStickMembersOpen(true)
  }

  const handleStickClick = (stickId: string) => {
    setSelectedStickId(stickId)
  }

  const handleChatClick = (e: React.MouseEvent, stickTopic: string) => {
    e.stopPropagation()
    setChatStickTopic(stickTopic)
    setChatModalOpen(true)
  }

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push("/video")
  }

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent" />
          <p className="text-purple-600 font-medium">Loading pad...</p>
        </div>
      </div>
    )
  }

  if (!pad) return null

  const memberCount = pad.social_pad_members?.[0]?.count || 0
  const pinnedSticks = sticks.filter((s) => s.is_pinned)
  const regularSticks = sticks.filter((s) => !s.is_pinned)

  return (
    <CommunicationPaletteProvider padId={pad.id} padName={pad.name}>
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-purple-100 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Social Hub", href: "/social" },
              { label: pad.name, current: true },
            ]}
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl social-gradient flex items-center justify-center shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {pad.name}
                </h1>
                {pad.description && <p className="text-sm text-gray-600">{pad.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Pad Chat Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowPadChat(true)
                  setPadChatCollapsed(false)
                }}
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                <MessagesSquare className="h-4 w-4 mr-2" />
                Pad Chat
              </Button>
              {isOwner && (
                <>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/social/pads/${padId}/analytics`)}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analytics
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setManageMembersOpen(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Members
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </>
              )}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {pad.is_public ? (
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-0">
                <Globe className="h-3 w-3 mr-1" />
                Public Pad
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-0">
                <Lock className="h-3 w-3 mr-1" />
                Private Pad
              </Badge>
            )}
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-0">
              <Users className="h-3 w-3 mr-1" />
              {memberCount} {memberCount === 1 ? "Member" : "Members"}
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-0">
              <FileText className="h-3 w-3 mr-1" />
              {sticks.length} {sticks.length === 1 ? "Stick" : "Sticks"}
            </Badge>
            {pinnedSticks.length > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0">
                <Pin className="h-3 w-3 mr-1" />
                {pinnedSticks.length} Pinned
              </Badge>
            )}
            {/* Real-time presence indicator */}
            {padMembers.length > 0 && (
              <PadPresenceIndicator
                members={padMembers}
                currentUserId={user?.id}
                maxDisplay={5}
              />
            )}
          </div>
          {user && canAddSticks && (
            <Button onClick={() => setCreateStickOpen(true)} className="social-gradient text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Stick
            </Button>
          )}
        </div>

        {sticks.length === 0 ? (
          <Card className="border-2 border-dashed border-purple-200 bg-white/50 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-full social-gradient mx-auto mb-6 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                No Sticks Yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Be the first to add content to this pad. Share your ideas, updates, or anything you&apos;d like to
                collaborate on!
              </p>
              {user && canAddSticks && (
                <Button
                  onClick={() => setCreateStickOpen(true)}
                  size="lg"
                  className="social-gradient text-white shadow-lg"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Create First Stick
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {pinnedSticks.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
                  <Pin className="h-5 w-5 text-amber-500" />
                  Pinned Sticks
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pinnedSticks.map((stick) => {
                    const replyCount = stick.social_stick_replies?.[0]?.count || 0
                    const reactionCount = stick.reaction_counts
                      ? Object.values(stick.reaction_counts).reduce((sum, count) => sum + count, 0)
                      : 0
                    return (
                      <Card
                        key={stick.id}
                        className="cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 border-amber-300 overflow-hidden group bg-gradient-to-br from-amber-50 to-white shadow-lg"
                        onClick={() => handleStickClick(stick.id)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base font-bold line-clamp-2 group-hover:text-purple-600 transition-colors">
                              {stick.topic}
                            </CardTitle>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => handleChatClick(e, stick.topic)}
                                title="New chat"
                              >
                                <MessagesSquare className="h-4 w-4 text-purple-500 hover:text-purple-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={handleVideoClick}
                                title="Start video call"
                              >
                                <Video className="h-4 w-4 text-blue-500 hover:text-blue-600" />
                              </Button>
                              <ScheduleMeetingButton stickId={stick.id} stickTopic={stick.topic} />
                              {canManageSticks && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => handlePinToggle(e, stick.id)}
                                    title="Unpin this stick"
                                  >
                                    <PinOff className="h-4 w-4 text-amber-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => handleManageStickMembers(e, stick)}
                                    title="Manage stick settings and members"
                                  >
                                    <Settings className="h-4 w-4 text-gray-600" />
                                  </Button>
                                </>
                              )}
                              <Pin className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{stick.content}</p>
                          <div className="flex items-center justify-between pt-2 border-t border-amber-200/50">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              {new Date(stick.created_at).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Heart className="h-3 w-3" />
                                <span>{reactionCount}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MessageCircle className="h-3 w-3" />
                                <span>{replyCount}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            {regularSticks.length > 0 && (
              <div>
                {pinnedSticks.length > 0 && <h2 className="text-xl font-bold mb-4 text-gray-900">All Sticks</h2>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regularSticks.map((stick) => {
                    const replyCount = stick.social_stick_replies?.[0]?.count || 0
                    const reactionCount = stick.reaction_counts
                      ? Object.values(stick.reaction_counts).reduce((sum, count) => sum + count, 0)
                      : 0
                    return (
                      <Card
                        key={stick.id}
                        className="cursor-pointer hover:shadow-2xl transition-all duration-300 border-2 border-gray-300 overflow-hidden group bg-white shadow-lg"
                        onClick={() => handleStickClick(stick.id)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base font-bold line-clamp-2 group-hover:text-purple-600 transition-colors">
                              {stick.topic}
                            </CardTitle>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => handleChatClick(e, stick.topic)}
                                title="New chat"
                              >
                                <MessagesSquare className="h-4 w-4 text-purple-500 hover:text-purple-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={handleVideoClick}
                                title="Start video call"
                              >
                                <Video className="h-4 w-4 text-blue-500 hover:text-blue-600" />
                              </Button>
                              <ScheduleMeetingButton stickId={stick.id} stickTopic={stick.topic} />
                              {canManageSticks && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => handlePinToggle(e, stick.id)}
                                    title="Pin this stick"
                                  >
                                    <Pin className="h-4 w-4 text-gray-400 hover:text-amber-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => handleManageStickMembers(e, stick)}
                                    title="Manage stick settings and members"
                                  >
                                    <Settings className="h-4 w-4 text-gray-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{stick.content}</p>
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              {new Date(stick.created_at).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Heart className="h-3 w-3" />
                                <span>{reactionCount}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MessageCircle className="h-3 w-3" />
                                <span>{replyCount}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {isOwner && (
        <>
          <ManageMembersDialog
            open={manageMembersOpen}
            onOpenChange={setManageMembersOpen}
            padId={pad.id}
            padName={pad.name}
          />
          <PadSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            pad={pad}
            currentUserId={user?.id || ""}
            onUpdate={fetchPadData}
          />
        </>
      )}

      {selectedStickId && (
        <StickDetailModal
          stickId={selectedStickId}
          open={!!selectedStickId}
          onOpenChange={(open) => {
            if (!open) setSelectedStickId(null)
          }}
        />
      )}

      {selectedStick && (
        <ManageStickMembersDialog
          open={manageStickMembersOpen}
          onOpenChange={setManageStickMembersOpen}
          stickId={selectedStick.id}
          stickTopic={selectedStick.topic}
          padId={padId}
        />
      )}

      <CreateStickModal isOpen={createStickOpen} onClose={handleStickCreated} padId={padId} />

      {/* Chat Modal */}
      <CreateChatModal
        open={chatModalOpen}
        onOpenChange={setChatModalOpen}
        defaultName={chatStickTopic}
        autoSubmit
      />

      {/* Embedded Pad Chat Panel */}
      {showPadChat && user && (
        <PadChatPanel
          padId={padId}
          padName={pad.name}
          currentUserId={user.id}
          isOwner={!!isOwner}
          isCollapsed={padChatCollapsed}
          onToggleCollapse={() => setPadChatCollapsed(!padChatCollapsed)}
          onClose={() => setShowPadChat(false)}
        />
      )}

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}
