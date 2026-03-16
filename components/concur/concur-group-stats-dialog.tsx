"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Loader2,
  Eye,
  MessageCircle,
  StickyNote,
  Users,
  TrendingUp,
  Crown,
} from "lucide-react"
import { format } from "date-fns"

// ============================================================================
// Types
// ============================================================================

interface StatsOverview {
  totalSticks: number
  totalReplies: number
  totalViews: number
  totalMembers: number
}

interface TopStick {
  id: string
  topic: string | null
  content: string
  createdAt: string
  authorName: string | null
  viewCount: number
  replyCount: number
}

interface ActiveMember {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  stickCount: number
  replyCount: number
  totalActivity: number
}

interface ActivityDay {
  day: string
  sticks: number
  replies: number
  views: number
}

interface MemberEngagement {
  membersPosted: number
  membersReplied: number
  membersViewed: number
  totalMembers: number
}

interface GroupStats {
  overview: StatsOverview
  topSticks: TopStick[]
  activeMembers: ActiveMember[]
  activityByDay: ActivityDay[]
  memberEngagement: MemberEngagement
}

interface ConcurGroupStatsDialogProps {
  groupId: string
  groupName: string
  onClose: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ConcurGroupStatsDialog({
  groupId,
  groupName,
  onClose,
}: ConcurGroupStatsDialogProps) {
  const [stats, setStats] = useState<GroupStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/concur/groups/${groupId}/stats`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error("Failed to fetch group stats:", error)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            Group Stats — {groupName}
          </DialogTitle>
          <DialogDescription>
            Engagement metrics for the last 30 days
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={<StickyNote className="h-4 w-4" />}
                label="Sticks"
                value={stats.overview.totalSticks}
                color="text-blue-600 bg-blue-50"
              />
              <StatCard
                icon={<MessageCircle className="h-4 w-4" />}
                label="Replies"
                value={stats.overview.totalReplies}
                color="text-green-600 bg-green-50"
              />
              <StatCard
                icon={<Eye className="h-4 w-4" />}
                label="Views"
                value={stats.overview.totalViews}
                color="text-purple-600 bg-purple-50"
              />
              <StatCard
                icon={<Users className="h-4 w-4" />}
                label="Members"
                value={stats.overview.totalMembers}
                color="text-orange-600 bg-orange-50"
              />
            </div>

            {/* Member Engagement */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Member Engagement</h3>
              <div className="grid grid-cols-3 gap-3">
                <EngagementBar
                  label="Posted"
                  count={stats.memberEngagement.membersPosted}
                  total={stats.memberEngagement.totalMembers}
                  color="bg-blue-500"
                />
                <EngagementBar
                  label="Replied"
                  count={stats.memberEngagement.membersReplied}
                  total={stats.memberEngagement.totalMembers}
                  color="bg-green-500"
                />
                <EngagementBar
                  label="Viewed"
                  count={stats.memberEngagement.membersViewed}
                  total={stats.memberEngagement.totalMembers}
                  color="bg-purple-500"
                />
              </div>
            </div>

            {/* 30-Day Activity Chart */}
            <div>
              <h3 className="text-sm font-semibold mb-2">30-Day Activity</h3>
              <ActivityChart data={stats.activityByDay} />
            </div>

            {/* Top Sticks */}
            {stats.topSticks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Most Viewed Sticks</h3>
                <div className="space-y-2">
                  {stats.topSticks.map((stick, i) => (
                    <div
                      key={stick.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {stick.topic || stick.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stick.authorName || "Unknown"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {stick.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {stick.replyCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Members */}
            {stats.activeMembers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Most Active Members</h3>
                <div className="space-y-2">
                  {stats.activeMembers.map((member, i) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                        {i + 1}
                      </span>
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {member.fullName?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.fullName || member.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1" title="Sticks posted">
                          <StickyNote className="h-3 w-3" />
                          {member.stickCount}
                        </span>
                        <span className="flex items-center gap-1" title="Replies">
                          <MessageCircle className="h-3 w-3" />
                          {member.replyCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            Failed to load stats
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  )
}

function EngagementBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="text-center">
      <div className="h-20 bg-gray-100 rounded-lg relative overflow-hidden flex items-end justify-center">
        <div
          className={`${color} w-full rounded-t-sm transition-all duration-500`}
          style={{ height: `${Math.max(pct, 4)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
          {pct}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {label} ({count}/{total})
      </p>
    </div>
  )
}

function ActivityChart({ data }: { data: ActivityDay[] }) {
  const maxValue = Math.max(
    ...data.map((d) => d.sticks + d.replies + d.views),
    1
  )

  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="flex items-end gap-[2px] h-24">
        {data.map((day) => {
          const total = day.sticks + day.replies + day.views
          const height = Math.max((total / maxValue) * 100, 2)
          const date = new Date(day.day)
          return (
            <div
              key={day.day}
              className="flex-1 group relative"
              title={`${format(date, "MMM d")}: ${day.sticks} sticks, ${day.replies} replies, ${day.views} views`}
            >
              <div
                className="bg-indigo-400 hover:bg-indigo-600 rounded-t-sm transition-colors w-full"
                style={{ height: `${height}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">
          {data.length > 0 ? format(new Date(data[0].day), "MMM d") : ""}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {data.length > 0 ? format(new Date(data[data.length - 1].day), "MMM d") : ""}
        </span>
      </div>
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span>Hover bars for details</span>
      </div>
    </div>
  )
}
