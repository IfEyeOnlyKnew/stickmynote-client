"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useUser } from "@/contexts/user-context"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Users, BarChart3, Settings, Loader2, Sparkles } from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

// Import panel components
import { CommunityPanel as CommunityPanelComponent } from "@/components/CommunityPanel"
import { AnalyticsPanel } from "@/components/AnalyticsPanel"
import { SettingsPanel } from "@/components/SettingsPanel"

export default function PanelPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("community")
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, userLoading, router])

  if (userLoading || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20">
      {/* Header */}
      <div className="glass-effect sticky top-0 z-50 border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push("/personal")}
                className="gap-2 hover:bg-purple-100/50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Personal
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <Image
                  src="/images/sticky-note-logo.svg"
                  alt="Sticky Note Logo"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Control Panel
                </h1>
              </div>
            </div>
            <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              Admin Dashboard
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Personal", href: "/personal" },
              { label: "Control Panel", current: true },
            ]}
          />

          {/* Welcome Section */}
          <Card className="mb-8 panel-card-enhanced border-0 shadow-lg overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600"></div>
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="metric-icon">
                  <Settings className="h-5 w-5 text-purple-600" />
                </div>
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Welcome to Your Control Panel
                </span>
              </CardTitle>
              <CardDescription className="text-base mt-2 text-gray-600 leading-relaxed">
                Manage your notes, view analytics, explore the community, and configure your settings all in one place.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-sm p-1.5 rounded-xl shadow-sm border">
              <TabsTrigger
                value="community"
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg transition-all"
              >
                <Users className="h-4 w-4" />
                <span className="font-medium">Community</span>
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg transition-all"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="font-medium">Analytics</span>
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg transition-all"
              >
                <Settings className="h-4 w-4" />
                <span className="font-medium">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="community" className="mt-6 tab-content">
              <CommunityPanelComponent />
            </TabsContent>

            <TabsContent value="analytics" className="mt-6 tab-content">
              <AnalyticsPanel />
            </TabsContent>

            <TabsContent value="settings" className="mt-6 tab-content">
              <SettingsPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
