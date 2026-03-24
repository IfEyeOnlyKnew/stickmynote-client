"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Search, Calendar, StickyNote, Zap } from "lucide-react"
import { BrowseAllPadsModal } from "@/components/browse-all-pads-modal"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { useHubModeGuard } from "@/hooks/use-hub-mode-guard"

export default function PaksPage() {
  const router = useRouter()
  const [isBrowsePadsModalOpen, setIsBrowsePadsModalOpen] = useState(false)

  const { isAuthorized, isLoading } = useHubModeGuard()

  if (isLoading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Alliance Hub", current: true },
          ]}
        />
      </div>

      <div className="flex justify-between items-center mb-8">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Alliance Hub</h1>
          <p className="text-gray-600">Organize your content with Pads and Sticks</p>
        </div>
        <div className="flex items-center">
          <UserMenu />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card className="hover:shadow-lg transition-shadow border-indigo-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-indigo-600" />
            </div>
            <CardTitle className="text-xl">My Pads</CardTitle>
            <CardDescription>View all Pads where you have access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <Button onClick={() => router.push("/mypads")} className="w-full bg-indigo-600 hover:bg-indigo-700">
                <FileText className="h-4 w-4 mr-2" />
                View My Pads
              </Button>
              <Button variant="outline" onClick={() => setIsBrowsePadsModalOpen(true)} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Browse All Pads
              </Button>
            </div>
            <div className="text-sm text-gray-500 text-center">Owner, Admin, Edit, or View permissions</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-teal-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
              <StickyNote className="h-6 w-6 text-teal-600" />
            </div>
            <CardTitle className="text-xl">My Sticks</CardTitle>
            <CardDescription>View all Sticks where you have access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => router.push("/mysticks")} className="w-full bg-teal-600 hover:bg-teal-700">
              <StickyNote className="h-4 w-4 mr-2" />
              View My Sticks
            </Button>
            <div className="text-sm text-gray-500 text-center">Owner, Admin, Edit, or View permissions</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-yellow-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle className="text-xl">QuickSticks</CardTitle>
            <CardDescription>Quick access to your important sticks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => router.push("/quicksticks")} className="w-full bg-yellow-600 hover:bg-yellow-700">
              <Zap className="h-4 w-4 mr-2" />
              Go to QuickSticks
            </Button>
            <div className="text-sm text-gray-500 text-center">Access your marked sticks instantly</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card className="hover:shadow-lg transition-shadow border-purple-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <CardTitle className="text-xl">CalSticks</CardTitle>
            <CardDescription>Task management with calendar dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => router.push("/calsticks")} className="w-full bg-purple-600 hover:bg-purple-700">
              <Calendar className="h-4 w-4 mr-2" />
              Go to CalSticks
            </Button>
            <div className="text-sm text-gray-500 text-center">View and manage task deadlines</div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <BrowseAllPadsModal
        open={isBrowsePadsModalOpen}
        onOpenChange={setIsBrowsePadsModalOpen}
        onPadSelect={(padId: string) => {
          setIsBrowsePadsModalOpen(false)
          router.push(`/pads/${padId}`)
        }}
      />
    </div>
  )
}
