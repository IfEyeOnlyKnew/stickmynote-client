"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  BarChart3,
  ChevronLeft,
  Users,
  MessageSquare,
  Folder,
  TrendingUp,
  Activity,
  Globe,
  Lock,
  Calendar,
  FileText,
  Clock,
  Award,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

interface AnalyticsData {
  overview: {
    totalPads: number
    publicPads: number
    privatePads: number
    totalSticks: number
    totalReplies: number
    totalMembers: number
    activeMembers: number
  }
  engagement: {
    replyRate: number
    averageRepliesPerStick: string
    recentActivity: number
  }
  mostActivePads: Array<{
    padId: string
    padName: string
    stickCount: number
  }>
  trends: {
    sticksThisWeek: number
    sticksLastWeek: number
    repliesThisWeek: number
    repliesLastWeek: number
    newMembersThisWeek: number
  }
  topContributors: Array<{
    userId: string
    userName: string | null
    userEmail: string
    stickCount: number
    replyCount: number
  }>
  activityByDay: Array<{
    day: string
    stickCount: number
    replyCount: number
  }>
  contentStats: {
    averageStickLength: number
    averageReplyLength: number
    totalTags: number
    totalVideos: number
    totalImages: number
  }
}

interface SocialAnalyticsSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function SocialAnalyticsSidebar({ isOpen, onClose }: SocialAnalyticsSidebarProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics()
    }
  }, [isOpen])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/social-analytics")
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-black/50 transition-opacity duration-300">
      <div
        id="social-analytics-sidebar"
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Social Analytics</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-white/50">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : analytics ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full grid grid-cols-3 sticky top-0 bg-white z-10 border-b rounded-none">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="p-6 space-y-6 mt-0">
                {/* Overview Section */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-800 border-b pb-2 flex items-center gap-2">
                    <Folder className="h-4 w-4 text-purple-600" />
                    Overview
                  </h3>
                  <div className="grid gap-3">
                    <Card className="bg-purple-50 border-purple-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">Total Pads</span>
                        </div>
                        <span className="text-2xl font-bold text-purple-600">{analytics.overview.totalPads}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded">
                          <Globe className="h-3 w-3" />
                          <span>{analytics.overview.publicPads} Public</span>
                        </div>
                        <div className="flex items-center gap-1 text-orange-700 bg-orange-100 px-2 py-1 rounded">
                          <Lock className="h-3 w-3" />
                          <span>{analytics.overview.privatePads} Private</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-800">Total Sticks</span>
                        <span className="text-2xl font-bold text-blue-600">{analytics.overview.totalSticks}</span>
                      </div>
                    </Card>

                    <Card className="bg-green-50 border-green-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Total Replies</span>
                        </div>
                        <span className="text-2xl font-bold text-green-600">{analytics.overview.totalReplies}</span>
                      </div>
                    </Card>

                    <Card className="bg-orange-50 border-orange-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-800">Members</span>
                        </div>
                        <span className="text-2xl font-bold text-orange-600">{analytics.overview.totalMembers}</span>
                      </div>
                      <div className="mt-2 text-xs text-orange-700">
                        <Activity className="h-3 w-3 inline mr-1" />
                        {analytics.overview.activeMembers} active this week
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Engagement Metrics */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-800 border-b pb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Engagement
                  </h3>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Avg Replies per Stick</span>
                      <span className="text-lg font-bold text-blue-600">
                        {analytics.engagement.averageRepliesPerStick}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Reply Rate</span>
                      <span className="text-lg font-bold text-purple-600">
                        {analytics.engagement.replyRate.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-700">Recent Activity (7 days)</span>
                      <span className="text-lg font-bold text-green-600">
                        {analytics.engagement.recentActivity} sticks
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats Summary */}
                <Card className="bg-gray-50 p-4">
                  <h4 className="font-medium text-gray-800 mb-3">Quick Stats</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Engagement Rate:</span>
                      <span className="font-medium">
                        {analytics.overview.totalSticks > 0
                          ? ((analytics.overview.totalReplies / analytics.overview.totalSticks) * 100).toFixed(1)
                          : "0"}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Active Member Rate:</span>
                      <span className="font-medium">
                        {analytics.overview.totalMembers > 0
                          ? ((analytics.overview.activeMembers / analytics.overview.totalMembers) * 100).toFixed(1)
                          : "0"}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Sticks per Pad:</span>
                      <span className="font-medium">
                        {analytics.overview.totalPads > 0
                          ? (analytics.overview.totalSticks / analytics.overview.totalPads).toFixed(1)
                          : "0"}
                      </span>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Trends Tab */}
              <TabsContent value="trends" className="p-6 space-y-6 mt-0">
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-800 border-b pb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    Weekly Trends
                  </h3>

                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">Sticks Created</span>
                      <Badge
                        variant={
                          analytics.trends.sticksThisWeek >= analytics.trends.sticksLastWeek ? "default" : "secondary"
                        }
                      >
                        {calculateTrend(analytics.trends.sticksThisWeek, analytics.trends.sticksLastWeek) > 0
                          ? "+"
                          : ""}
                        {calculateTrend(analytics.trends.sticksThisWeek, analytics.trends.sticksLastWeek).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-3xl font-bold text-blue-600">{analytics.trends.sticksThisWeek}</div>
                        <div className="text-xs text-blue-700">This Week</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-blue-500">{analytics.trends.sticksLastWeek}</div>
                        <div className="text-xs text-blue-600">Last Week</div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-900">Replies Posted</span>
                      <Badge
                        variant={
                          analytics.trends.repliesThisWeek >= analytics.trends.repliesLastWeek ? "default" : "secondary"
                        }
                      >
                        {calculateTrend(analytics.trends.repliesThisWeek, analytics.trends.repliesLastWeek) > 0
                          ? "+"
                          : ""}
                        {calculateTrend(analytics.trends.repliesThisWeek, analytics.trends.repliesLastWeek).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-3xl font-bold text-green-600">{analytics.trends.repliesThisWeek}</div>
                        <div className="text-xs text-green-700">This Week</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-green-500">{analytics.trends.repliesLastWeek}</div>
                        <div className="text-xs text-green-600">Last Week</div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-900">New Members</span>
                      <Badge variant="default">This Week</Badge>
                    </div>
                    <div className="text-3xl font-bold text-purple-600">{analytics.trends.newMembersThisWeek}</div>
                    <div className="text-xs text-purple-700 mt-1">Joined in last 7 days</div>
                  </Card>
                </div>

                {/* Activity by Day Chart */}
                {analytics.activityByDay && analytics.activityByDay.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-800 border-b pb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      Daily Activity (Last 7 Days)
                    </h3>
                    <div className="space-y-2">
                      {analytics.activityByDay.map((day) => {
                        const maxActivity = Math.max(...analytics.activityByDay.map((d) => d.stickCount + d.replyCount))
                        const totalActivity = day.stickCount + day.replyCount
                        const percentage = maxActivity > 0 ? (totalActivity / maxActivity) * 100 : 0

                        return (
                          <div key={day.day} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-gray-700">{day.day}</span>
                              <span className="text-gray-500">{totalActivity} activities</span>
                            </div>
                            <div className="flex gap-1 h-6 bg-gray-100 rounded overflow-hidden">
                              <div
                                className="bg-blue-500 transition-all"
                                style={{ width: `${(day.stickCount / (maxActivity || 1)) * 100}%` }}
                                title={`${day.stickCount} sticks`}
                              />
                              <div
                                className="bg-green-500 transition-all"
                                style={{ width: `${(day.replyCount / (maxActivity || 1)) * 100}%` }}
                                title={`${day.replyCount} replies`}
                              />
                            </div>
                            <div className="flex gap-3 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                {day.stickCount} sticks
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                {day.replyCount} replies
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Insights Tab */}
              <TabsContent value="insights" className="p-6 space-y-6 mt-0">
                {/* Most Active Pads */}
                {analytics.mostActivePads.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-800 border-b pb-2 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-green-600" />
                      Most Active Pads
                    </h3>
                    <div className="space-y-2">
                      {analytics.mostActivePads.map((pad, index) => (
                        <Card key={pad.padId} className="p-3 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  index === 0
                                    ? "bg-yellow-100 text-yellow-700"
                                    : index === 1
                                      ? "bg-gray-100 text-gray-700"
                                      : index === 2
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium truncate">{pad.padName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-bold text-purple-600">
                              <MessageSquare className="h-3 w-3" />
                              {pad.stickCount}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Contributors */}
                {analytics.topContributors && analytics.topContributors.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-800 border-b pb-2 flex items-center gap-2">
                      <Award className="h-4 w-4 text-purple-600" />
                      Top Contributors
                    </h3>
                    <div className="space-y-2">
                      {analytics.topContributors.map((contributor, index) => (
                        <Card key={contributor.userId} className="p-3 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  index === 0
                                    ? "bg-yellow-100 text-yellow-700"
                                    : index === 1
                                      ? "bg-gray-100 text-gray-700"
                                      : index === 2
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {contributor.userName?.charAt(0).toUpperCase() ||
                                  contributor.userEmail.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {contributor.userName || contributor.userEmail}
                                </div>
                                <div className="text-xs text-gray-500 flex gap-3">
                                  <span>{contributor.stickCount} sticks</span>
                                  <span>{contributor.replyCount} replies</span>
                                </div>
                              </div>
                            </div>
                            <Badge variant="secondary">{contributor.stickCount + contributor.replyCount}</Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Statistics */}
                {analytics.contentStats && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-800 border-b pb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Content Statistics
                    </h3>
                    <Card className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Stick Length</span>
                        <span className="font-medium">{analytics.contentStats.averageStickLength} chars</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Reply Length</span>
                        <span className="font-medium">{analytics.contentStats.averageReplyLength} chars</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm text-gray-600">Total Tags</span>
                        <Badge variant="outline">{analytics.contentStats.totalTags}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Videos Shared</span>
                        <Badge variant="outline">{analytics.contentStats.totalVideos}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Images Shared</span>
                        <Badge variant="outline">{analytics.contentStats.totalImages}</Badge>
                      </div>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No analytics data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
