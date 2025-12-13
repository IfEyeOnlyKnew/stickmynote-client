"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StickyNote, Users, FileText, ArrowRight, Share2, AlertCircle } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { HubSetupModal } from "@/components/social/hub-setup-modal"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { createClient } from "@/lib/supabase/client"
import { OrgBrandedHeader } from "@/components/organization/org-branded-header"
import { HubModeSelector } from "@/components/onboarding/hub-mode-selector"

export default function DashboardPage() {
  const router = useRouter()
  const { user, profile, loading, refreshProfile } = useUser()
  const { currentOrg, currentOrgRole, loading: orgLoading } = useOrganization()
  const [setupModalOpen, setSetupModalOpen] = useState(false)
  const [openCalSticksCount, setOpenCalSticksCount] = useState(0)
  const [showHubModeSelector, setShowHubModeSelector] = useState(false)
  const [hubMode, setHubMode] = useState<"personal_only" | "full_access" | null>(null)

  const userEmail = profile?.email || user?.email || ""
  const isOwner = currentOrgRole === "owner"
  const isSupportContact =
    currentOrg?.support_contact_1_email === userEmail || currentOrg?.support_contact_2_email === userEmail

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && profile && !profile.hub_mode) {
      setShowHubModeSelector(true)
    } else if (profile?.hub_mode) {
      setHubMode(profile.hub_mode)
    }
  }, [user, profile])

  useEffect(() => {
    const fetchCalSticksCount = async () => {
      if (!user) return

      try {
        const supabase = createClient()
        const { count, error } = await supabase
          .from("paks_pad_stick_replies")
          .select("*", { count: "exact", head: true })
          .eq("is_calstick", true)
          .eq("calstick_completed", false)

        if (!error && count !== null) {
          setOpenCalSticksCount(count)
        } else {
          setOpenCalSticksCount(0)
        }
      } catch (err) {
        setOpenCalSticksCount(0)
      }
    }

    fetchCalSticksCount()
  }, [user])

  const handleHubModeComplete = async (mode: "personal_only" | "full_access") => {
    setHubMode(mode)
    setShowHubModeSelector(false)
    await refreshProfile()
  }

  if (loading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (showHubModeSelector && user && profile) {
    return (
      <HubModeSelector
        open={showHubModeSelector}
        onComplete={handleHubModeComplete}
        userId={user.id}
        userEmail={profile.email}
      />
    )
  }

  if (hubMode === "personal_only") {
    router.push("/notes")
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <BreadcrumbNav items={[{ label: "Dashboard", current: true }]} />

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="w-[120px]">{/* Empty space for balance */}</div>
          <div className="text-center flex-1">
            <div className="flex items-center justify-center mb-2">
              <OrgBrandedHeader showLogo={true} showName={true} />
            </div>
          </div>
          <div className="flex items-center">
            <UserMenu />
          </div>
        </div>

        {/* Main Choice Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Notes Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-blue-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <StickyNote className="h-8 w-8 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Personal Hub</CardTitle>
              <CardDescription className="text-base">
                Create and manage your personal sticks with full control over sharing and organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Private by default, share when you want
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Rich media support (images, videos)
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  AI-powered tag generation
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Reply and collaboration features
                </div>
              </div>
              <Button
                onClick={() => router.push("/notes")}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Personal Hub
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Paks Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-green-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Paks Hub</CardTitle>
              <CardDescription className="text-base">
                Access collaborative Pads for team projects and organized content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Multi-Pads for team collaboration
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Individual Pads for personal projects
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Team invitations and sharing
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Organized workspace management
                </div>
              </div>
              <Button
                onClick={() => router.push("/paks")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Paks Hub
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              {openCalSticksCount >= 1 && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => router.push("/calsticks")}
                    className="text-red-600 hover:text-red-700 font-bold text-lg flex items-center justify-center w-full transition-colors animate-pulse"
                  >
                    <AlertCircle className="h-5 w-5 mr-2" />
                    CalSticks Open
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Hub Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-purple-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Share2 className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Social Hub</CardTitle>
              <CardDescription className="text-base">
                Collaborate with teams through Social Pads and Sticks with enterprise-grade social features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  Social Pads for team collaboration
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  Personalized feeds and trending content
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  Knowledge sharing and Q&A
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  Role-based permissions (Owner/Admin/Edit)
                </div>
              </div>
              <Button
                onClick={() => router.push("/social")}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Social Hub
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Info Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-6 text-sm flex-wrap justify-center">
            <Badge variant="secondary" className="px-4 py-2">
              <StickyNote className="h-4 w-4 mr-2" />
              Notes: Personal & Shareable
            </Badge>
            <Badge variant="secondary" className="px-4 py-2">
              <FileText className="h-4 w-4 mr-2" />
              Paks: Team & Individual Workspaces
            </Badge>
            <Badge variant="secondary" className="px-4 py-2">
              <Share2 className="h-4 w-4 mr-2" />
              Social Hub: Enterprise Collaboration
            </Badge>
          </div>
          <p className="text-gray-500 text-sm max-w-3xl mx-auto">
            You can switch between Notes, Paks, and Social Hub anytime. Each section offers powerful features for
            organizing, collaborating, and engaging with your content and teams.
          </p>
        </div>
      </div>

      <HubSetupModal open={setupModalOpen} onOpenChange={setSetupModalOpen} />
    </div>
  )
}
