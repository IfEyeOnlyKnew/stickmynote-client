"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import type { PadAnalytics } from "@/types/analytics"
import { BarChart3, TrendingUp, Users, FileText, MessageCircle, Heart, Clock, Award, Activity } from "lucide-react"

export default function PadAnalyticsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const params = useParams()
  const padId = params.padId as string

  const [analytics, setAnalytics] = useState<PadAnalytics | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth")
      return
    }

    if (user && padId) {
      fetchAnalytics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, padId])

  const fetchAnalytics = async () => {
    setLoadingData(true)
    try {
      const response = await fetch(`/api/inference-pads/${padId}/analytics`)

      if (response.status === 401) {
        router.push("/auth")
        return
      }

      if (response.status === 403) {
        router.push("/inference")
        return
      }

      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.analytics)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    } finally {
      setLoadingData(false)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent" />
          <p className="text-purple-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!analytics) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-purple-100 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Inference Hub", href: "/inference" },
              { label: analytics.pad_name, href: `/inference/pads/${padId}` },
              { label: "Analytics", current: true },
            ]}
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl inference-gradient flex items-center justify-center shadow-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Pad Analytics
                </h1>
                <p className="text-sm text-gray-600">{analytics.pad_name}</p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription>Total Sticks</CardDescription>
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">{analytics.total_sticks}</div>
              <p className="text-xs text-muted-foreground mt-1">{analytics.sticks_this_week} this week</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription>Total Replies</CardDescription>
                <MessageCircle className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{analytics.total_replies}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all sticks</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription>Total Reactions</CardDescription>
                <Heart className="h-5 w-5 text-pink-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-pink-900">{analytics.total_reactions}</div>
              <p className="text-xs text-muted-foreground mt-1">Engagement</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription>Members</CardDescription>
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">{analytics.total_members}</div>
              <p className="text-xs text-muted-foreground mt-1">Active collaborators</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <span className="font-medium">This Week</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {analytics.sticks_this_week} sticks
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">This Month</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {analytics.sticks_this_month} sticks
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Engagement Rate</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {analytics.engagement_rate}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Top Contributors
              </CardTitle>
              <CardDescription>Most active members in this pad</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.top_contributors.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No contributors yet</p>
              ) : (
                <div className="space-y-3">
                  {analytics.top_contributors.map((contributor, index) => (
                    <div
                      key={contributor.user_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
                              {(contributor.full_name || contributor.email).substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {index === 0 && (
                            <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
                              <Award className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{contributor.full_name || contributor.email}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{contributor.stick_count} sticks</span>
                            <span>•</span>
                            <span>{contributor.reply_count} replies</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={index === 0 ? "default" : "secondary"}>#{index + 1}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Engagement Overview</CardTitle>
            <CardDescription>How your pad is performing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Sticks Created</span>
                  <span className="text-sm font-bold">{analytics.total_sticks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Replies</span>
                  <span className="text-sm font-bold">{analytics.total_replies}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((analytics.total_replies / Math.max(analytics.total_sticks, 1)) * 50, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Reactions</span>
                  <span className="text-sm font-bold">{analytics.total_reactions}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-pink-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((analytics.total_reactions / Math.max(analytics.total_sticks, 1)) * 30, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
