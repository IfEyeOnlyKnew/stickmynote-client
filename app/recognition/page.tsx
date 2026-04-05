"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sparkles, Trophy, Award, Heart, Plus } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { GiveKudosModal } from "@/components/recognition/give-kudos-modal"
import { RecognitionFeed } from "@/components/recognition/recognition-feed"
import { RecognitionStats } from "@/components/recognition/recognition-stats"
import { BadgeDisplay } from "@/components/recognition/badge-display"
import { Leaderboard } from "@/components/recognition/leaderboard"
import type { RecognitionValue } from "@/types/recognition"

export default function RecognitionPage() {
  const router = useRouter()
  const { user, loading } = useUser()
  const { loading: orgLoading } = useOrganization()
  const [giveKudosOpen, setGiveKudosOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("feed")
  const [filterValueId, setFilterValueId] = useState<string | null>(null)
  const [values, setValues] = useState<RecognitionValue[]>([])
  const [feedKey, setFeedKey] = useState(0)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    fetch("/api/recognition/values")
      .then(res => res.json())
      .then(data => setValues(data.values || []))
      .catch(() => {})
  }, [])

  // Seed defaults on first visit
  useEffect(() => {
    if (user) {
      fetch("/api/recognition/badges/seed", { method: "POST" }).catch(() => {})
    }
  }, [user])

  if (loading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <BreadcrumbNav items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recognition Hub", current: true },
        ]} />

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              Recognition Hub
            </h1>
            <p className="text-gray-500 mt-1 ml-[52px]">Celebrate your team&apos;s achievements and recognize great work</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setGiveKudosOpen(true)}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Give Kudos
            </Button>
            <UserMenu />
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <RecognitionStats />
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="feed" className="flex items-center gap-1.5">
              <Heart className="h-4 w-4" />
              Recognition Wall
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              My Badges
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Feed */}
              <div className="lg:col-span-3">
                <RecognitionFeed key={feedKey} filterValueId={filterValueId} />
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Filter by Value */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Filter by Value</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      <button
                        onClick={() => { setFilterValueId(null); setFeedKey(k => k + 1) }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          filterValueId ? "hover:bg-gray-50" : "bg-gray-100 font-medium"
                        }`}
                      >
                        All Values
                      </button>
                      {values.map(value => (
                        <button
                          key={value.id}
                          onClick={() => { setFilterValueId(value.id); setFeedKey(k => k + 1) }}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                            filterValueId === value.id ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
                          }`}
                        >
                          <span>{value.emoji}</span>
                          {value.name}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Mini Leaderboard */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Leaderboard compact maxEntries={5} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Recognition Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Leaderboard />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="badges">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-500" />
                  My Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BadgeDisplay userId={user.id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Give Kudos Modal */}
      <GiveKudosModal
        open={giveKudosOpen}
        onOpenChange={setGiveKudosOpen}
        onSuccess={() => {
          setFeedKey(k => k + 1)
        }}
      />
    </div>
  )
}
