"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Globe, Lock, Plus, Bell, Menu, X } from "lucide-react"
import { MobilePadView } from "@/components/inference/mobile-pad-view"
import { useInferenceNotifications } from "@/hooks/use-inference-notifications"
import { useRealtimeSticks } from "@/hooks/use-realtime-sticks"
import { usePresence } from "@/hooks/use-presence"
import { RealtimeIndicator } from "@/components/inference/realtime-indicator"
import { PresenceAvatars } from "@/components/inference/presence-avatars"

interface Pad {
  id: string
  name: string
  description: string | null
  is_public: boolean
  hub_type: "individual" | "organization" | null
  created_at: string
}

interface Stick {
  id: string
  topic: string
  content: string
  color: string
  social_pad_id: string
  created_at: string
}

interface Reply {
  id: string
  content: string
  user_id: string
  created_at: string
}

export default function MobileInferenceLayout() {
  const router = useRouter()
  const [publicPads] = useState<Pad[]>([])
  const [privatePads] = useState<Pad[]>([])
  const [publicSticksByPad] = useState<Record<string, Stick[]>>({})
  const [privateSticksByPad] = useState<Record<string, Stick[]>>({})
  const [expandedSticks, setExpandedSticks] = useState<Set<string>>(new Set())
  const [replies, setReplies] = useState<Record<string, Reply[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("public")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { unreadCount } = useInferenceNotifications()

  const fetchContent = async () => {
    // Fetch logic similar to main inference page
    setLoading(false)
  }

  const { isConnected: realtimeConnected } = useRealtimeSticks({
    onStickCreated: fetchContent,
    onStickUpdated: fetchContent,
    onStickDeleted: fetchContent,
    onReplyCreated: fetchContent,
  })

  const { presenceUsers, isConnected: presenceConnected } = usePresence()

  useEffect(() => {
    fetchContent()
  }, [])

  const handleStickToggle = async (stickId: string) => {
    const newExpandedSticks = new Set(expandedSticks)

    if (expandedSticks.has(stickId)) {
      newExpandedSticks.delete(stickId)
      setExpandedSticks(newExpandedSticks)
    } else {
      newExpandedSticks.add(stickId)
      setExpandedSticks(newExpandedSticks)

      if (!(stickId in replies)) {
        try {
          const response = await fetch(`/api/inference-sticks/${stickId}/replies`)
          if (response.ok) {
            const data = await response.json()
            setReplies((prev) => ({ ...prev, [stickId]: data.replies || [] }))
          }
        } catch (error) {
          console.error("[v0] Error fetching replies:", error)
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-gray-900">Inference Hub</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="relative h-9 w-9 p-0"
                onClick={() => router.push("/inference/notifications")}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RealtimeIndicator isConnected={realtimeConnected && presenceConnected} />
            {presenceUsers.length > 0 && <PresenceAvatars users={presenceUsers} />}
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t bg-white p-4">
            <Button
              className="w-full mb-2 bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                router.push("/inference/hubs")
                setMobileMenuOpen(false)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Inference Pad
            </Button>
          </div>
        )}
      </div>

      <div className="px-3 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="public" className="flex items-center gap-1 text-xs">
              <Globe className="h-3 w-3" />
              Public
            </TabsTrigger>
            <TabsTrigger value="private" className="flex items-center gap-1 text-xs">
              <Lock className="h-3 w-3" />
              Private
            </TabsTrigger>
          </TabsList>

          <TabsContent value="public" className="space-y-4">
            {publicPads.length > 0 ? (
              publicPads.map((pad) => (
                <MobilePadView
                  key={pad.id}
                  pad={pad}
                  sticks={publicSticksByPad[pad.id] || []}
                  onStickView={(id) => router.push(`/inference/sticks/${id}`)}
                  onStickToggle={handleStickToggle}
                  expandedSticks={expandedSticks}
                  replies={replies}
                />
              ))
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Globe className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No Public Pads Yet</h3>
                  <p className="text-sm text-gray-600 mb-4">Create a public inference pad to get started!</p>
                  <Button onClick={() => router.push("/inference/hubs")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Pad
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="private" className="space-y-4">
            {privatePads.length > 0 ? (
              privatePads.map((pad) => (
                <MobilePadView
                  key={pad.id}
                  pad={pad}
                  sticks={privateSticksByPad[pad.id] || []}
                  onStickView={(id) => router.push(`/inference/sticks/${id}`)}
                  onStickToggle={handleStickToggle}
                  expandedSticks={expandedSticks}
                  replies={replies}
                />
              ))
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No Private Pads Yet</h3>
                  <p className="text-sm text-gray-600 mb-4">Create a private inference pad to get started!</p>
                  <Button onClick={() => router.push("/inference/hubs")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Pad
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed bottom-4 right-4 z-50">
        <Button
          className="rounded-full w-14 h-14 shadow-lg bg-purple-600 hover:bg-purple-700"
          onClick={() => router.push("/inference/hubs")}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}
