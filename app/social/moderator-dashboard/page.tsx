"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import {
  Shield,
  MessageSquare,
  Clock,
  Users,
  Globe,
  Lock,
  Bot,
  Crown,
  ExternalLink,
  RefreshCw,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface ModeratedPad {
  id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
  is_owner: boolean
  permissions: {
    can_pin: boolean
    can_delete: boolean
    can_mute: boolean
    can_manage_settings: boolean
  }
  recent_message_count: number
  last_message: {
    content: string
    created_at: string
    is_ai_message: boolean
  } | null
}

export default function ModeratorDashboardPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [pads, setPads] = useState<ModeratedPad[]>([])
  const [loadingPads, setLoadingPads] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPads = async () => {
    try {
      const response = await fetch("/api/social-pads/my-moderated-pads")
      if (response.ok) {
        const data = await response.json()
        setPads(data.pads || [])
      }
    } catch (error) {
      console.error("Error fetching moderated pads:", error)
    } finally {
      setLoadingPads(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login?redirectTo=/social/moderator-dashboard")
      return
    }

    if (user) {
      fetchPads()
      // Refresh every 30 seconds
      const interval = setInterval(fetchPads, 30000)
      return () => clearInterval(interval)
    }
  }, [user, loading, router])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchPads()
  }

  if (loading || loadingPads) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent" />
          <p className="text-purple-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-purple-100 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Social Hub", href: "/social" },
              { label: "Moderator Dashboard", current: true },
            ]}
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  Moderator Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  Manage all your moderated Pad Chats
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700">Total Moderated Pads</p>
                  <p className="text-3xl font-bold text-amber-900">{pads.length}</p>
                </div>
                <Shield className="h-10 w-10 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Messages (24h)</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {pads.reduce((sum, pad) => sum + pad.recent_message_count, 0)}
                  </p>
                </div>
                <MessageSquare className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700">Pads Owned</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {pads.filter((p) => p.is_owner).length}
                  </p>
                </div>
                <Crown className="h-10 w-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pads list */}
        {pads.length === 0 ? (
          <Card className="border-2 border-dashed border-amber-200 bg-white/50">
            <CardContent className="py-16 text-center">
              <Shield className="h-16 w-16 text-amber-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2 text-gray-700">
                No Moderated Pads
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                You&apos;re not currently a moderator of any Pad Chats. Create a new pad
                or ask a pad owner to add you as a moderator.
              </p>
              <Button
                onClick={() => router.push("/social")}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              >
                Go to Social Hub
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pads.map((pad) => (
              <Card
                key={pad.id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-amber-400"
                onClick={() => router.push(`/social/pads/${pad.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {pad.name}
                        </h3>
                        {pad.is_owner && (
                          <Badge className="bg-purple-100 text-purple-700 border-0">
                            <Crown className="h-3 w-3 mr-1" />
                            Owner
                          </Badge>
                        )}
                        {!pad.is_owner && (
                          <Badge className="bg-amber-100 text-amber-700 border-0">
                            <Shield className="h-3 w-3 mr-1" />
                            Moderator
                          </Badge>
                        )}
                        {pad.is_public ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-0">
                            <Globe className="h-3 w-3 mr-1" />
                            Public
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-0">
                            <Lock className="h-3 w-3 mr-1" />
                            Private
                          </Badge>
                        )}
                      </div>

                      {pad.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                          {pad.description}
                        </p>
                      )}

                      {pad.last_message && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {pad.last_message.is_ai_message && (
                            <Bot className="h-3 w-3 text-purple-500" />
                          )}
                          <span className="truncate max-w-[300px]">
                            {pad.last_message.content}
                          </span>
                          <span className="text-gray-400">·</span>
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(pad.last_message.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      {pad.recent_message_count > 0 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {pad.recent_message_count}
                          </div>
                          <div className="text-xs text-gray-500">messages (24h)</div>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/social/pads/${pad.id}`)
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">Permissions:</span>
                    {pad.permissions.can_pin && (
                      <Badge variant="outline" className="text-xs">
                        Pin
                      </Badge>
                    )}
                    {pad.permissions.can_delete && (
                      <Badge variant="outline" className="text-xs">
                        Delete
                      </Badge>
                    )}
                    {pad.permissions.can_mute && (
                      <Badge variant="outline" className="text-xs">
                        Mute
                      </Badge>
                    )}
                    {pad.permissions.can_manage_settings && (
                      <Badge variant="outline" className="text-xs">
                        Settings
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
