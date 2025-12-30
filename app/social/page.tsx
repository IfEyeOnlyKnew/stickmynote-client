"use client"

import React, { Fragment, useEffect, useState, useCallback, useRef } from "react"
import type { WorkflowStatus } from "@/types/social-workflow"
import { DecisionCockpitSidebar } from "@/components/social/decision-cockpit-sidebar"
import { PromoteToCalStickDialog } from "@/components/social/promote-to-calstick-dialog"

import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Globe,
  Lock,
  MessageSquare,
  Calendar,
  ChevronDown,
  ChevronRight,
  User,
  Plus,
  Eye,
  Settings,
  Bell,
  Activity,
  SearchIcon,
  BarChart3,
  X,
  Menu,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Shield,
} from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { formatDistanceToNow } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { StickDetailModal } from "@/components/social/stick-detail-modal"
import { useSocialNotifications } from "@/hooks/use-social-notifications"
import { useRealtimeSticks } from "@/hooks/use-realtime-sticks"
import { usePresence } from "@/hooks/use-presence"
import { PresenceAvatars } from "@/components/social/presence-avatars"
import { RealtimeIndicator } from "@/components/social/realtime-indicator"
import { useCommandPalette } from "@/hooks/use-keyboard-shortcuts"
import { CommandPalette } from "@/components/social/command-palette"
import { BulkActionsToolbar } from "@/components/social/bulk-actions-toolbar"
import { KeyboardShortcutsHelp } from "@/components/social/keyboard-shortcuts-help"
import { Checkbox } from "@/components/ui/checkbox"
import { ActivityFeedModal } from "@/components/social/activity-feed-modal"
import { NotificationsModal } from "@/components/social/notifications-modal"
import { useHubModeGuard } from "@/hooks/use-hub-mode-guard"
import { PadQADialog } from "@/components/social/pad-qa-dialog"
import { KnowledgeBaseDrawer } from "@/components/social/knowledge-base-drawer"
import { FollowButton } from "@/components/social/follow-button"
import { WorkflowStatusBadge } from "@/components/social/workflow-status-badge"
import { SocialAnalyticsSidebar } from "@/components/social/social-analytics-sidebar"

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 1000,
): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After")
        const delay = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : baseDelay * Math.pow(2, attempt)
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }
        // Return null on final rate limit to allow graceful degradation
        return null
      }

      return response
    } catch (error) {
      console.error("Fetch attempt failed:", error)
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // Return null instead of throwing to allow graceful degradation
  return null
}

async function safeJsonParse<T>(response: Response | null, defaultValue: T): Promise<T> {
  if (!response?.ok) return defaultValue

  const contentType = response.headers.get("content-type")
  if (!contentType?.includes("application/json")) {
    return defaultValue
  }

  try {
    return await response.json()
  } catch {
    return defaultValue
  }
}

function groupSticksByPadVisibility(
  sticks: { social_pad_id: string; reply_count?: number }[],
  allPads: { id: string; is_public: boolean }[],
): { publicGrouped: Record<string, any[]>; privateGrouped: Record<string, any[]> } {
  const publicGrouped: Record<string, any[]> = {}
  const privateGrouped: Record<string, any[]> = {}

  for (const stick of sticks) {
    const padId = stick.social_pad_id
    const pad = allPads.find((p) => p.id === padId)

    if (pad?.is_public) {
      if (!publicGrouped[padId]) publicGrouped[padId] = []
      publicGrouped[padId].push(stick)
    } else {
      if (!privateGrouped[padId]) privateGrouped[padId] = []
      privateGrouped[padId].push(stick)
    }
  }

  return { publicGrouped, privateGrouped }
}

function sortStickGroups(
  groups: Record<string, { created_at: string }[]>,
): Record<string, any[]> {
  return Object.entries(groups).reduce(
    (acc, [padId, padSticks]) => {
      acc[padId] = padSticks.toSorted(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      return acc
    },
    {} as Record<string, any[]>,
  )
}

async function processInvitesForPad(padId: string): Promise<void> {
  try {
    console.log("[v0] Checking for pending invites to process")
    const processResponse = await fetchWithRetry(
      `/api/pads/${padId}/process-invites`,
      { method: "POST", credentials: "include" },
      2,
      500,
    )
    if (processResponse) {
      const processData = await safeJsonParse<{ message: string }>(processResponse, { message: "" })
      if (processData.message) {
        console.log("[v0] Processed pending invites:", processData.message)
      }
    }
  } catch (error) {
    // Silently ignore invite processing errors - expected for users without pending invites
    console.debug("Invite processing skipped:", error)
  }
}

interface SocialPad {
  id: string
  name: string
  description: string | null
  is_public: boolean
  hub_type: "individual" | "organization" | null
  created_at: string
  owner_id?: string
  user_role?: string
}

interface Reply {
  id: string
  content: string
  color: string
  created_at: string
  calstick_id?: string | null
  promoted_at?: string | null
  users?: {
    full_name: string | null
    email: string
  }
}

interface SocialStick {
  id: string
  topic: string
  content: string
  color: string
  social_pad_id: string
  user_id: string
  created_at: string
  users?: {
    id: string
    full_name: string | null
    email: string
  } | null
  reply_count?: number
  live_summary?: string
  workflow_status?: WorkflowStatus
  workflow_owner_id?: string | null
  calstick_id?: string | null
}

interface StickTableRowProps {
  stick: SocialStick
  replies: Reply[]
  isExpanded: boolean
  isSelected: boolean
  onToggle: (stickId: string) => void
  onSelect: (stickId: string) => void
  onOpen: (stickId: string) => void
  onPromoteReply: (stickId: string, topic: string, stickContent: string, replyId: string, replyContent: string) => void
  onNavigateToCalstick: (calstickId: string) => void
}

const StickTableRow = React.memo(function StickTableRow({
  stick,
  replies,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onOpen,
  onPromoteReply,
  onNavigateToCalstick,
}: StickTableRowProps) {
  const handleRowClick = useCallback(() => {
    onToggle(stick.id)
  }, [onToggle, stick.id])

  const handleCheckboxChange = useCallback(() => {
    onSelect(stick.id)
  }, [onSelect, stick.id])

  const handleOpenClick = useCallback(() => {
    onOpen(stick.id)
  }, [onOpen, stick.id])

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <Fragment>
      <TableRow className="cursor-pointer hover:bg-gray-50" onClick={handleRowClick}>
        <TableCell onClick={stopPropagation}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            onClick={stopPropagation}
          />
        </TableCell>
        <TableCell>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <div className="w-1 h-8 rounded" style={{ backgroundColor: stick.color }} />
            {stick.topic}
          </div>
        </TableCell>
        <TableCell onClick={stopPropagation}>
          <WorkflowStatusBadge status={stick.workflow_status || "idea"} size="sm" />
        </TableCell>
        <TableCell className="max-w-md">
          {stick.live_summary ? (
            <div className="space-y-1">
              <p className="line-clamp-2 text-sm text-gray-600">{stick.content}</p>
              <p className="text-xs text-blue-600 italic line-clamp-1">{stick.live_summary}</p>
            </div>
          ) : (
            <p className="line-clamp-2 text-sm text-gray-600">{stick.content}</p>
          )}
        </TableCell>
        <TableCell className="text-sm">
          {stick.users?.full_name || stick.users?.email || "Unknown"}
        </TableCell>
        <TableCell className="text-center">
          <Badge variant="secondary" className="flex items-center gap-1 justify-center">
            <MessageSquare className="h-3 w-3" />
            {stick.reply_count || 0}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-gray-500">
          {formatDistanceToNow(new Date(stick.created_at), { addSuffix: true })}
        </TableCell>
        <TableCell className="text-center" onClick={stopPropagation}>
          <Button variant="ghost" size="sm" onClick={handleOpenClick} title="View and edit stick">
            <Eye className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-gray-50">
            <div className="py-4 px-6">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Replies ({replies?.length || 0})
              </h4>
              {replies && replies.length > 0 ? (
                <div className="space-y-3">
                  {replies.map((reply) => (
                    <Card
                      key={reply.id}
                      className="p-4"
                      style={{ borderLeftWidth: "3px", borderLeftColor: reply.color }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm mb-2">{reply.content}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {reply.users?.full_name || reply.users?.email || "Unknown"}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {reply.calstick_id ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onNavigateToCalstick(reply.calstick_id!)}
                              title="View in CalSticks"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onPromoteReply(stick.id, stick.topic, stick.content || '', reply.id, reply.content)}
                              title="Promote this reply to CalStick"
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No replies yet</p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
})

export default function SocialHubPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { currentOrg } = useOrganization()
  const { isAuthorized, isLoading: guardLoading } = useHubModeGuard()
  const [publicPads, setPublicPads] = useState<SocialPad[]>([])
  const [privatePads, setPrivatePads] = useState<SocialPad[]>([])
  const [publicSticks, setPublicSticks] = useState<Record<string, SocialStick[]>>({})
  const [privateSticks, setPrivateSticks] = useState<Record<string, SocialStick[]>>({})
  const [expandedSticks, setExpandedSticks] = useState<Set<string>>(new Set())
  const [replies, setReplies] = useState<Record<string, Reply[]>>({})
  const [loading, setLoading] = useState(true)
  const initialTab = searchParams.get("tab") || "public"
  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedStickId, setSelectedStickId] = useState<string | null>(null)
  const [stickModalOpen, setStickModalOpen] = useState(false)
  const { unreadCount } = useSocialNotifications()
  const [isAnalyticsSidebarOpen, setIsAnalyticsSidebarOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [selectedStickIds, setSelectedStickIds] = useState<Set<string>>(new Set())
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const { isOpen: isCommandPaletteOpen, setIsOpen: setIsCommandPaletteOpen } = useCommandPalette()
    const [kbDrawerPadId, setKbDrawerPadId] = useState<string | null>(null)

  const [isDecisionCockpitOpen, setIsDecisionCockpitOpen] = useState(false)
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false)
  
  const [replyToPromote, setReplyToPromote] = useState<{
    stickId: string
    replyId: string
    replyContent: string
    stickTopic: string
    stickContent: string
  } | null>(null)

  const fetchAttempted = useRef(false)
  const initialPadId = searchParams.get("padId")

    const [showActivityModal, setShowActivityModal] = useState(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)

  const handleReplyCreated = async (reply: any) => {
    const response = await fetch(`/api/social-sticks/${reply.social_stick_id}`)
    if (response.ok) {
      const stickData = await response.json()
      if (stickData.last_summarized_at && stickData.reply_count > stickData.summary_reply_count) {
        fetch(`/api/social-sticks/${reply.social_stick_id}/summarize`, {
          method: "POST",
        }).catch((error) => console.error("Background summarization failed:", error))
      }
    }
    fetchData()
  }

  const { isConnected: realtimeConnected } = useRealtimeSticks({
    onStickCreated: () => void fetchData(),
    onStickUpdated: () => void fetchData(),
    onStickDeleted: () => void fetchData(),
    onReplyCreated: (reply) => void handleReplyCreated(reply),
  })

  const { presenceUsers, isConnected: presenceConnected } = usePresence()

  const fetchData = useCallback(async () => {
    if (!user || fetchAttempted.current) return
    fetchAttempted.current = true

    setLoading(true)
    try {
      // Fetch pads
      const padsResponse = await fetchWithRetry("/api/social-pads")
      const padsData = await safeJsonParse<{ pads: SocialPad[] }>(padsResponse, { pads: [] })
      const allPads = padsData.pads || []

      if (allPads.length > 0) console.log("[v0] Total pads fetched:", allPads.length)

      const publicPadsList = allPads.filter((pad: SocialPad) => pad.is_public)
      const privatePadsList = allPads.filter((pad: SocialPad) => !pad.is_public)

      console.log("[v0] Public pads:", publicPadsList.length)
      console.log("[v0] Private pads:", privatePadsList.length)

      setPublicPads(publicPadsList)
      setPrivatePads(privatePadsList)

      // Fetch sticks
      const timestamp = Date.now()
      const sticksResponse = await fetchWithRetry(
        `/api/social-sticks?_t=${timestamp}`,
        { credentials: "include", headers: { "Cache-Control": "no-cache" } },
        3,
        1000,
      )

      const sticksData = await safeJsonParse<{ sticks: SocialStick[] }>(sticksResponse, { sticks: [] })
      const sticks = sticksData.sticks || []

      if (sticks.length > 0) console.log("[v0] Total sticks fetched:", sticks.length)

      const sticksWithCounts = sticks.map((stick: SocialStick) => ({
        ...stick,
        reply_count: stick.reply_count || 0,
      }))

      // Group and sort sticks
      const { publicGrouped, privateGrouped } = groupSticksByPadVisibility(sticksWithCounts, allPads)
      const sortedPublicSticks = sortStickGroups(publicGrouped)
      const sortedPrivateSticks = sortStickGroups(privateGrouped)

      console.log("[v0] Public sticks count:", Object.values(sortedPublicSticks).flat().length)
      console.log("[v0] Private sticks count:", Object.values(sortedPrivateSticks).flat().length)

      setPublicSticks(sortedPublicSticks)
      setPrivateSticks(sortedPrivateSticks)

      // Process invites if needed
      if (initialPadId) {
        await processInvitesForPad(initialPadId)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }, [user, initialPadId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const currentTab = searchParams.get("tab") || "public"
    if (currentTab !== activeTab) {
      setActiveTab(currentTab)
    }
  }, [searchParams, activeTab])

  const toggleStick = async (stickId: string) => {
    const newExpandedSticks = new Set(expandedSticks)

    if (expandedSticks.has(stickId)) {
      newExpandedSticks.delete(stickId)
      setExpandedSticks(newExpandedSticks)
    } else {
      newExpandedSticks.add(stickId)
      setExpandedSticks(newExpandedSticks)

      if (!replies[stickId]) {
        try {
          const response = await fetch(`/api/social-sticks/${stickId}/replies`)
          if (response.ok) {
            const data = await response.json()
            setReplies((prev) => ({ ...prev, [stickId]: data.replies || [] }))
          }
        } catch (error) {
          console.error("Error fetching replies:", error)
        }
      }
    }
  }

  const handleOpenStick = (stickId: string) => {
    setSelectedStickId(stickId)
    setStickModalOpen(true)
  }

  const handleStickModalClose = () => {
    setStickModalOpen(false)
    setSelectedStickId(null)
    setExpandedSticks(new Set())
    setReplies({})
    fetchData()
  }

  const handleTabChange = (value: string) => {
    console.log("[v0] Tab change to:", value)
    setActiveTab(value)
    const newUrl = new URL(globalThis.location.href)
    newUrl.searchParams.set("tab", value)
    globalThis.history.replaceState({}, "", newUrl.toString())
  }

  const handleToggleStickSelection = (stickId: string, event?: React.MouseEvent) => {
    if (event?.shiftKey && selectedStickIds.size > 0) {
      const currentSticks = activeTab === "public" ? publicSticks : privateSticks
      const allStickIds = Object.values(currentSticks)
        .flat()
        .map((s) => s.id)
      const lastSelectedId = Array.from(selectedStickIds)[selectedStickIds.size - 1]
      const startIndex = allStickIds.indexOf(lastSelectedId)
      const endIndex = allStickIds.indexOf(stickId)
      const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
      const rangeIds = allStickIds.slice(from, to + 1)
      setSelectedStickIds(new Set([...selectedStickIds, ...rangeIds]))
    } else {
      const newSelected = new Set(selectedStickIds)
      if (newSelected.has(stickId)) {
        newSelected.delete(stickId)
      } else {
        newSelected.add(stickId)
      }
      setSelectedStickIds(newSelected)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedStickIds.size} stick(s)?`)) return

    try {
      await Promise.all(
        Array.from(selectedStickIds).map((id) => fetch(`/api/social-sticks/${id}`, { method: "DELETE" })),
      )
      setSelectedStickIds(new Set())
      fetchData()
    } catch (error) {
      console.error("Error deleting sticks:", error)
    }
  }

  const handleClearSelection = () => {
    setSelectedStickIds(new Set())
  }

  const handleBulkStatusChange = async (status: WorkflowStatus) => {
    try {
      await Promise.all(
        Array.from(selectedStickIds).map((id) =>
          fetch(`/api/social-sticks/${id}/workflow`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }),
        ),
      )
      setSelectedStickIds(new Set())
      fetchData()
    } catch (error) {
      console.error("Error updating workflow status:", error)
    }
  }

  const handleOpenPromoteReplyDialog = (stickId: string, stickTopic: string, stickContent: string, replyId: string, replyContent: string) => {
    setReplyToPromote({ stickId, replyId, replyContent, stickTopic, stickContent })
    setPromoteDialogOpen(true)
  }

  const handlePromoteReplyToCalStick = async (data: { priority: string; dueDate: string; assigneeId?: string }) => {
    if (!replyToPromote) return

    const response = await fetch(
      `/api/v2/social-sticks/${replyToPromote.stickId}/replies/${replyToPromote.replyId}/promote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to promote")
    }

    // Refresh the replies for this stick
    const repliesResponse = await fetch(`/api/social-sticks/${replyToPromote.stickId}/replies`)
    if (repliesResponse.ok) {
      const repliesData = await repliesResponse.json()
      setReplies((prev) => ({ ...prev, [replyToPromote.stickId]: repliesData.replies || [] }))
    }

    fetchData()
  }

  const handlePadCheckboxChange = useCallback(
    (_padId: string, sticks: SocialStick[], checked: boolean | "indeterminate") => {
      const newSelected = new Set(selectedStickIds)
      if (checked === true) {
        sticks.forEach((s) => newSelected.add(s.id))
      } else {
        sticks.forEach((s) => newSelected.delete(s.id))
      }
      setSelectedStickIds(newSelected)
    },
    [selectedStickIds],
  )

  const handleNavigateToCalstick = useCallback(
    (calstickId: string) => {
      router.push(`/calsticks?stickId=${calstickId}`)
    },
    [router],
  )

  const recentPads = [...publicPads, ...privatePads]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((pad) => ({ id: pad.id, name: pad.name }))

  const renderPadsWithSticks = (pads: SocialPad[], sticksByPad: Record<string, SocialStick[]>, isPublic: boolean) => {
    if (pads.length === 0) {
      return (
        <Card className="text-center py-12">
          <CardContent>
            {isPublic ? (
              <Globe className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            ) : (
              <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            )}
            <h3 className="text-xl font-semibold mb-2">No {isPublic ? "Public" : "Private"} Pads Yet</h3>
            <p className="text-gray-600">Create a {isPublic ? "public" : "private"} social pad to get started!</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-8 sm:space-y-6">
        {pads.map((pad) => {
          const userRole = pad.user_role || (pad.owner_id === user?.id ? "owner" : "")
          const isViewer = userRole === "viewer"
          const canManagePad = !isViewer

          return (
            <div key={pad.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">{pad.name}</h2>
                  <FollowButton entityType="social_pad" entityId={pad.id} entityName={pad.name} variant="compact" />
                  {canManagePad && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/social/pads/${pad.id}`)}
                      title="Manage pad settings and members"
                      className="h-8 w-8"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setKbDrawerPadId(pad.id)}
                    title="Open Knowledge Base"
                    className="h-8 w-8"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <PadQADialog padId={pad.id} padName={pad.name} />
                  <span className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(pad.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {pad.description && <p className="text-gray-600">{pad.description}</p>}

              {sticksByPad[pad.id] && sticksByPad[pad.id].length > 0 ? (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              sticksByPad[pad.id].every((s) => selectedStickIds.has(s.id)) &&
                              sticksByPad[pad.id].length > 0
                            }
                            onCheckedChange={(checked) =>
                              handlePadCheckboxChange(pad.id, sticksByPad[pad.id], checked)
                            }
                          />
                        </TableHead>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead className="w-32">Author</TableHead>
                        <TableHead className="w-24 text-center">Replies</TableHead>
                        <TableHead className="w-32">Created</TableHead>
                        <TableHead className="w-20 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sticksByPad[pad.id].map((stick) => (
                        <StickTableRow
                          key={stick.id}
                          stick={stick}
                          replies={replies[stick.id] || []}
                          isExpanded={expandedSticks.has(stick.id)}
                          isSelected={selectedStickIds.has(stick.id)}
                          onToggle={toggleStick}
                          onSelect={handleToggleStickSelection}
                          onOpen={handleOpenStick}
                          onPromoteReply={handleOpenPromoteReplyDialog}
                          onNavigateToCalstick={handleNavigateToCalstick}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ) : (
                <Card className="p-6 text-center text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No sticks in this pad yet</p>
                </Card>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (guardLoading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Social Hub", current: true },
          ]}
        />

        <div className="mb-6 sm:mb-8 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Social Hub</h1>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600 hidden sm:block">
                Manage your public and private social pads
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">Cmd+K</kbd> for quick actions or{" "}
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">?</kbd> for shortcuts
              </p>
              <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
                <RealtimeIndicator isConnected={realtimeConnected && presenceConnected} />
                {presenceUsers.length > 0 && <PresenceAvatars users={presenceUsers} />}
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <Button variant="outline" onClick={() => router.push("/social/search")}>
                <SearchIcon className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button variant="outline" onClick={() => setShowActivityModal(true)}>
                <Activity className="h-4 w-4 mr-2" />
                Activity
              </Button>
              <Button
                variant="outline"
                className="relative bg-transparent"
                onClick={() => setShowNotificationsModal(true)}
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
              {!currentOrg?.settings?.disable_manual_hub_creation && (
                <Button onClick={() => router.push("/social/hubs")} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Social Pad
                </Button>
              )}
              <Button
                onClick={() => router.push("/social/admin/cleanup-policies")}
                className="bg-green-600 hover:bg-green-700"
              >
                <Shield className="h-4 w-4 mr-2" />
                Cleanup Policies
              </Button>
              <UserMenu />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden flex-shrink-0 bg-transparent"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>

          {isMobileMenuOpen && (
            <Card className="lg:hidden">
              <CardContent className="p-4 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    router.push("/social/search")
                    setIsMobileMenuOpen(false)
                  }}
                >
                  <SearchIcon className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setShowActivityModal(true)
                    setIsMobileMenuOpen(false)
                  }}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Activity
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start relative"
                  onClick={() => {
                    setShowNotificationsModal(true)
                    setIsMobileMenuOpen(false)
                  }}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    router.push("/social/admin/cleanup-policies")
                    setIsMobileMenuOpen(false)
                  }}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Cleanup Policies
                </Button>
                {!currentOrg?.settings?.disable_manual_hub_creation && (
                  <div className="pt-2 border-t">
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => {
                        router.push("/social/hubs")
                        setIsMobileMenuOpen(false)
                      }}
                    >
                      <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="public" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm cursor-pointer">
              <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Public Social Hub</span>
              <span className="sm:hidden">Public</span>
              {publicPads.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {publicPads.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="private" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm cursor-pointer">
              <Lock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Private Social Hub</span>
              <span className="sm:hidden">Private</span>
              {privatePads.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {privatePads.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="public" className="space-y-4 sm:space-y-6">
            {renderPadsWithSticks(publicPads, publicSticks, true)}
          </TabsContent>

          <TabsContent value="private" className="space-y-4 sm:space-y-6">
            {renderPadsWithSticks(privatePads, privateSticks, false)}
          </TabsContent>
        </Tabs>
      </div>

      <Button
        id="analytics-trigger"
        onClick={() => setIsDecisionCockpitOpen((p) => !p)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9997] shadow-lg hover:shadow-xl transition-shadow duration-200 rounded-full w-12 h-12 sm:w-14 sm:h-14 p-0 bg-purple-600 hover:bg-purple-700"
        size="lg"
      >
        <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>

      <DecisionCockpitSidebar
        isOpen={isDecisionCockpitOpen}
        onClose={() => setIsDecisionCockpitOpen(false)}
        onFilterSelect={() => {}}
      />

      <SocialAnalyticsSidebar isOpen={isAnalyticsSidebarOpen} onClose={() => setIsAnalyticsSidebarOpen(false)} />

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        recentPads={recentPads}
        onCreateStick={() => router.push("/social/hubs")}
        onCreatePad={currentOrg?.settings?.disable_manual_hub_creation ? undefined : () => router.push("/social/hubs")}
      />

      <BulkActionsToolbar
        selectedCount={selectedStickIds.size}
        onClear={handleClearSelection}
        onDelete={handleBulkDelete}
        onChangeStatus={handleBulkStatusChange}
      />

      <KeyboardShortcutsHelp open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp} />

      {selectedStickId && (
        <StickDetailModal
          open={stickModalOpen}
          onOpenChange={handleStickModalClose}
          stickId={selectedStickId}
          onUpdate={fetchData}
        />
      )}

      <ActivityFeedModal open={showActivityModal} onOpenChange={setShowActivityModal} />
      <NotificationsModal open={showNotificationsModal} onOpenChange={setShowNotificationsModal} />
      {kbDrawerPadId && (
        <KnowledgeBaseDrawer
          open={!!kbDrawerPadId}
          onOpenChange={(open) => !open && setKbDrawerPadId(null)}
          padId={kbDrawerPadId}
        />
      )}

      {replyToPromote && (
        <PromoteToCalStickDialog
          open={promoteDialogOpen}
          onOpenChange={(open) => {
            setPromoteDialogOpen(open)
            if (!open) setReplyToPromote(null)
          }}
          stickId={replyToPromote.stickId}
          replyId={replyToPromote.replyId}
          replyContent={replyToPromote.replyContent}
          stickTopic={replyToPromote.stickTopic}
          stickContent={replyToPromote.stickContent}
          onPromote={handlePromoteReplyToCalStick}
        />
      )}
    </div>
  )
}
