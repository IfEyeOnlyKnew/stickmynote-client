"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Loader2,
  Users,
  MessageCircle,
  Plus,
  Pin,
  Settings,
  Eye,
  TrendingUp,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ConcurStickDetailModal } from "@/components/concur/concur-stick-detail-modal"
import { ConcurGroupStatsDialog } from "@/components/concur/concur-group-stats-dialog"
import { CreateConcurStickDialog } from "@/components/concur/create-concur-stick-dialog"
import { ConcurMembersDialog } from "@/components/concur/concur-members-dialog"
import { ConcurGroupSettingsDialog } from "@/components/concur/concur-group-settings-dialog"

interface ConcurGroup {
  id: string
  name: string
  description: string | null
  user_role: string
  member_count: number
  settings: {
    logo_url?: string | null
    header_image_url?: string | null
  } | null
}

interface ConcurStick {
  id: string
  topic: string | null
  content: string
  color: string
  is_pinned: boolean
  user_id: string
  created_at: string
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  reply_count: number
  view_count: number
}

export default function ConcurGroupPage() {
  const params = useParams()
  const groupId = params.groupId as string

  const [group, setGroup] = useState<ConcurGroup | null>(null)
  const [sticks, setSticks] = useState<ConcurStick[]>([])
  const [loading, setLoading] = useState(true)
  const [sticksLoading, setSticksLoading] = useState(true)
  const [selectedStick, setSelectedStick] = useState<ConcurStick | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showMembersDialog, setShowMembersDialog] = useState(false)
  const [showStatsDialog, setShowStatsDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  const isOwner = group?.user_role === "owner"

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/concur/groups/${groupId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setGroup(data.group)
    } catch (error) {
      console.error("Failed to fetch group:", error)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  const fetchSticks = useCallback(async () => {
    try {
      setSticksLoading(true)
      const res = await fetch(`/api/concur/groups/${groupId}/sticks?limit=50`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setSticks(data.sticks || [])
    } catch (error) {
      console.error("Failed to fetch sticks:", error)
    } finally {
      setSticksLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    fetchGroup()
    fetchSticks()
  }, [fetchGroup, fetchSticks])

  const handleStickCreated = () => {
    setShowCreateDialog(false)
    fetchSticks()
  }

  const handleSelectStick = (stick: ConcurStick) => {
    setSelectedStick(stick)
    // Record view (fire-and-forget)
    fetch(`/api/concur/groups/${groupId}/sticks/${stick.id}/view`, {
      method: "POST",
    }).catch(() => {})
  }

  const handleStickUpdated = () => {
    fetchSticks()
  }

  const pinnedSticks = sticks.filter((s) => s.is_pinned)
  const regularSticks = sticks.filter((s) => !s.is_pinned)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Group not found or access denied.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <BreadcrumbNav
                items={[
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "Concur", href: "/concur" },
                  { label: group.name },
                ]}
              />
              <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
                {group.settings?.logo_url ? (
                  <img
                    src={group.settings.logo_url}
                    alt={`${group.name} logo`}
                    className="h-7 w-7 rounded object-cover"
                  />
                ) : (
                  <MessageCircle className="h-6 w-6 text-indigo-600" />
                )}
                {group.name}
              </h1>
              {group.description && (
                <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSettingsDialog(true)}
                    className="gap-1"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStatsDialog(true)}
                    className="gap-1"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span className="hidden sm:inline">Stats</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMembersDialog(true)}
                    className="gap-1"
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Members ({group.member_count})</span>
                  </Button>
                </>
              )}
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="gap-1 bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Stick</span>
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Header Image Banner */}
      {group.settings?.header_image_url && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <img
            src={group.settings.header_image_url}
            alt={`${group.name} header`}
            className="w-full h-36 rounded-lg object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {sticksLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : sticks.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold text-muted-foreground">No Sticks Yet</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Be the first to create a stick in this group.
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create First Stick
            </Button>
          </div>
        ) : (
          <>
            {/* Pinned Sticks */}
            {pinnedSticks.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                  <Pin className="h-4 w-4" />
                  Pinned
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pinnedSticks.map((stick) => (
                    <StickCard
                      key={stick.id}
                      stick={stick}
                      groupName={group.name}
                      groupLogoUrl={group.settings?.logo_url}
                      groupHeaderImageUrl={group.settings?.header_image_url}
                      onClick={() => handleSelectStick(stick)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Sticks */}
            <div>
              {pinnedSticks.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">All Sticks</h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {regularSticks.map((stick) => (
                  <StickCard
                    key={stick.id}
                    stick={stick}
                    groupName={group.name}
                    groupLogoUrl={group.settings?.logo_url}
                    groupHeaderImageUrl={group.settings?.header_image_url}
                    onClick={() => handleSelectStick(stick)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Stick Detail Modal */}
      {selectedStick && (
        <ConcurStickDetailModal
          groupId={groupId}
          groupName={group?.name || "Concur Group"}
          groupLogoUrl={group?.settings?.logo_url}
          stick={selectedStick}
          isOwner={isOwner}
          onClose={() => setSelectedStick(null)}
          onStickUpdated={handleStickUpdated}
        />
      )}

      {/* Create Stick Dialog */}
      {showCreateDialog && (
        <CreateConcurStickDialog
          groupId={groupId}
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleStickCreated}
        />
      )}

      {/* Members Dialog */}
      {showMembersDialog && (
        <ConcurMembersDialog
          groupId={groupId}
          onClose={() => setShowMembersDialog(false)}
        />
      )}

      {/* Stats Dialog */}
      {showStatsDialog && group && (
        <ConcurGroupStatsDialog
          groupId={groupId}
          groupName={group.name}
          onClose={() => setShowStatsDialog(false)}
        />
      )}

      {/* Settings Dialog */}
      {showSettingsDialog && group && (
        <ConcurGroupSettingsDialog
          groupId={groupId}
          groupName={group.name}
          currentLogoUrl={group.settings?.logo_url || null}
          currentHeaderImageUrl={group.settings?.header_image_url || null}
          onClose={() => setShowSettingsDialog(false)}
          onUpdated={fetchGroup}
        />
      )}
    </div>
  )
}

// ============================================================================
// Stick Card Component
// ============================================================================

function StickCard({
  stick,
  groupName,
  groupLogoUrl,
  groupHeaderImageUrl,
  onClick,
}: {
  stick: ConcurStick
  groupName: string
  groupLogoUrl?: string | null
  groupHeaderImageUrl?: string | null
  onClick: () => void
}) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all duration-200 overflow-hidden"
      onClick={onClick}
    >
      {/* Header image with logo + group name overlay */}
      {groupHeaderImageUrl && (
        <div className="relative h-28">
          <img
            src={groupHeaderImageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5">
            {groupLogoUrl && (
              <img
                src={groupLogoUrl}
                alt=""
                className="h-6 w-6 rounded object-cover border border-white/30 shadow-sm"
              />
            )}
            <span className="text-xs font-semibold text-white drop-shadow-sm truncate max-w-[180px]">
              {groupName}
            </span>
          </div>
          {stick.is_pinned && (
            <div className="absolute top-2 right-2">
              <Pin className="h-3.5 w-3.5 text-white drop-shadow-sm" />
            </div>
          )}
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {stick.topic && (
              <h3 className="font-semibold text-sm truncate">{stick.topic}</h3>
            )}
            <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
              {stick.content}
            </p>
          </div>
          {stick.is_pinned && !groupHeaderImageUrl && (
            <Pin className="h-4 w-4 text-indigo-500 shrink-0" />
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={stick.user?.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {stick.user?.full_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {stick.user?.full_name || "Unknown"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {stick.view_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {stick.reply_count}
            </span>
            <span>{formatDistanceToNow(new Date(stick.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
