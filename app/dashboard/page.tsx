"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StickyNote, Users, FileText, ArrowRight, Share2, MessagesSquare, Video, CalendarCheck, Download, BookOpen, Info, Sparkles } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { UserMenu } from "@/components/user-menu"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { HubSetupModal } from "@/components/inference/hub-setup-modal"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { OrgBrandedHeader } from "@/components/organization/org-branded-header"
import Link from "next/link"

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading } = useUser()
  const { loading: orgLoading } = useOrganization()
  const [setupModalOpen, setSetupModalOpen] = useState(false)
  const [openCalSticksCount, setOpenCalSticksCount] = useState(0)
  const [unreadChatsCount, setUnreadChatsCount] = useState(0)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchCalSticksCount = async () => {
      if (!user) return

      try {
        const response = await fetch("/api/calsticks/count")
        const data = await response.json()
        setOpenCalSticksCount(data.count ?? 0)
      } catch (err) {
        console.error("[Dashboard] CalSticks fetch error:", err)
        setOpenCalSticksCount(0)
      }
    }

    fetchCalSticksCount()
  }, [user])

  useEffect(() => {
    const fetchUnreadChats = async () => {
      if (!user) return

      try {
        const response = await fetch("/api/stick-chats")
        const data = await response.json()
        const totalUnread = (data.chats || []).reduce(
          (sum: number, chat: { unread_count?: number }) => sum + (chat.unread_count || 0),
          0
        )
        setUnreadChatsCount(totalUnread)
      } catch (err) {
        console.error("[Dashboard] Chats fetch error:", err)
        setUnreadChatsCount(0)
      }
    }

    fetchUnreadChats()
  }, [user])

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
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/download">
                <Download className="h-4 w-4 mr-1.5" />
                Install App
              </Link>
            </Button>
            <UserMenu />
          </div>
        </div>

        {/* Replacement Statement */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 leading-relaxed">
            <span className="font-medium text-yellow-700">Your Stick</span> replaces Engage &middot;{" "}
            <span className="font-medium text-blue-700">Your Stick</span> replaces OneNote &middot;{" "}
            <span className="font-medium text-purple-700">Your Stick</span> replaces MS Teams
          </p>
          <p className="text-sm font-medium text-gray-600 mt-1">
            Your Stick is the source of truth.
          </p>
        </div>

        {/* Main Choice Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Notes Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-blue-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <StickyNote className="h-8 w-8 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900 flex items-center justify-center gap-2">
                Concur Hub
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors" aria-label="What is Concur?">
                      <Info className="h-3 w-3 text-gray-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm font-normal text-gray-700">
                    <p className="font-semibold text-gray-900 mb-1">Concur</p>
                    <p>In a working environment, to concur means to agree with a colleague&apos;s idea, decision, or assessment, often in a formal or professional way. It can also describe multiple people or departments acting together in support of the same plan or outcome.</p>
                  </PopoverContent>
                </Popover>
              </CardTitle>
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
                onClick={() => router.push("/concur/sticks")}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Concur Hub
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
              <CardTitle className="text-2xl text-gray-900 flex items-center justify-center gap-2">
                Alliance Hub
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors" aria-label="What is Alliance?">
                      <Info className="h-3 w-3 text-gray-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm font-normal text-gray-700">
                    <p className="font-semibold text-gray-900 mb-1">Alliance</p>
                    <p>In a working environment, an alliance is a deliberate, mutually beneficial relationship where colleagues or groups align their efforts and interests to advance shared goals and support one another&apos;s success.</p>
                  </PopoverContent>
                </Popover>
              </CardTitle>
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
                Go to Alliance Hub
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Inference Hub Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-purple-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Share2 className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900 flex items-center justify-center gap-2">
                Inference Hub
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors" aria-label="What is Inference?">
                      <Info className="h-3 w-3 text-gray-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm font-normal text-gray-700">
                    <p className="font-semibold text-gray-900 mb-1">Inference</p>
                    <p>In a working environment, inference is the process of drawing a conclusion or judgment from available data, observations, or statements rather than direct, explicit instructions. It means using evidence (metrics, feedback, behavior, past results) plus your existing knowledge to decide what is probably true or what action to take.</p>
                  </PopoverContent>
                </Popover>
              </CardTitle>
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
                onClick={() => router.push("/inference")}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Inference Hub
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Chats Hub Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-teal-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-4 relative">
                <MessagesSquare className="h-8 w-8 text-teal-600" />
                {unreadChatsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    {unreadChatsCount > 99 ? "99+" : unreadChatsCount}
                  </span>
                )}
              </div>
              <CardTitle className="text-2xl text-gray-900">Chats Hub</CardTitle>
              <CardDescription className="text-base">
                Real-time conversations with teammates and per-stick discussions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mr-2"></div>
                  Per-stick chat rooms
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mr-2"></div>
                  Standalone group chats
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mr-2"></div>
                  Export chats to DOCX
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mr-2"></div>
                  30-day auto-expiration
                </div>
              </div>
              <Button
                onClick={() => router.push("/chats")}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Chats Hub
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Video Hub Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-rose-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
                <Video className="h-8 w-8 text-rose-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Video Hub</CardTitle>
              <CardDescription className="text-base">
                Face-to-face video calls and screen sharing with your team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-rose-500 rounded-full mr-2"></div>
                  One-on-one video calls
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-rose-500 rounded-full mr-2"></div>
                  Group video meetings
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-rose-500 rounded-full mr-2"></div>
                  Screen sharing
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-rose-500 rounded-full mr-2"></div>
                  No downloads required
                </div>
              </div>
              <Button
                onClick={() => router.push("/video")}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Video Hub
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* CalSticks Hub Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-orange-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 relative">
                <CalendarCheck className="h-8 w-8 text-orange-600" />
                {openCalSticksCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    {openCalSticksCount > 99 ? "99+" : openCalSticksCount}
                  </span>
                )}
              </div>
              <CardTitle className="text-2xl text-gray-900">CalSticks</CardTitle>
              <CardDescription className="text-base">
                Task management with Kanban boards, calendars, and Gantt charts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                  Kanban board with drag-drop
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                  Calendar and Gantt views
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                  WIP limits and swimlanes
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                  Smart capture and auto-schedule
                </div>
              </div>
              <Button
                onClick={() => router.push("/calsticks")}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to CalSticks
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Noted Hub Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-indigo-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-indigo-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Noted</CardTitle>
              <CardDescription className="text-base">
                Your notebook — turn any Stick into a rich, organized page with full formatting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                  Rich text editor with formatting
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                  Organize pages into groups
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                  Task lists, headings, and code blocks
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                  Permission-aware — respects Stick sharing
                </div>
              </div>
              <Button
                onClick={() => router.push("/noted")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Noted
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Recognition Hub Section */}
          <Card className="hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-yellow-300">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900 flex items-center justify-center gap-2">
                Recognition Hub
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors" aria-label="What is Recognition?">
                      <Info className="h-3 w-3 text-gray-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm font-normal text-gray-700">
                    <p className="font-semibold text-gray-900 mb-1">Recognition & Praise</p>
                    <p>Celebrate your team&apos;s achievements with kudos, badges, and a live recognition wall. Give public praise tied to your organization&apos;s core values and watch your culture thrive.</p>
                  </PopoverContent>
                </Popover>
              </CardTitle>
              <CardDescription className="text-base">
                Give kudos, earn badges, and celebrate your team&apos;s achievements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                  Kudos with organization values
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                  Achievement badges and streaks
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                  Live recognition wall and reactions
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                  Leaderboard and team insights
                </div>
              </div>
              <Button
                onClick={() => router.push("/recognition")}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 text-lg"
                size="lg"
              >
                Go to Recognition Hub
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
              Alliance: Team & Individual Workspaces
            </Badge>
            <Badge variant="secondary" className="px-4 py-2">
              <Share2 className="h-4 w-4 mr-2" />
              Inference Hub: Enterprise Collaboration
            </Badge>
            <Badge variant="secondary" className="px-4 py-2">
              <MessagesSquare className="h-4 w-4 mr-2" />
              Chats: Real-time Conversations
            </Badge>
            <Badge variant="secondary" className="px-4 py-2">
              <Video className="h-4 w-4 mr-2" />
              Video: Face-to-Face Meetings
            </Badge>
            <Badge variant="secondary" className="px-4 py-2">
              <CalendarCheck className="h-4 w-4 mr-2" />
              CalSticks: Task Management
            </Badge>
          </div>
          <p className="text-gray-500 text-sm max-w-3xl mx-auto">
            You can switch between Notes, Alliance Hub, Inference Hub, and CalSticks anytime. Each section offers powerful features for
            organizing, collaborating, and engaging with your content and teams.
          </p>
        </div>
      </div>

      <HubSetupModal open={setupModalOpen} onOpenChange={setSetupModalOpen} />
    </div>
  )
}
