"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from 'next/navigation'
import type { PadWithRole } from "@/lib/data/pads-data"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus } from 'lucide-react'
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CreatePadModal } from "@/components/create-pad-modal"
import {
  CommunicationPaletteProvider,
  CommunicationModals,
} from "@/components/communication"

interface MyPadsClientProps {
  initialPads: PadWithRole[]
}

export function MyPadsClient({ initialPads }: Readonly<MyPadsClientProps>) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredPads = useMemo(() => {
    return initialPads.filter((pad) => {
      const matchesSearch =
        pad.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pad.description?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesTab =
        activeTab === "all" ||
        (activeTab === "owner" && pad.userRole === "owner") ||
        (activeTab === "admin" && pad.userRole === "admin") ||
        (activeTab === "editor" && pad.userRole === "editor") ||
        (activeTab === "viewer" && pad.userRole === "viewer")

      return matchesSearch && matchesTab
    })
  }, [initialPads, searchQuery, activeTab])

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800"
      case "admin":
        return "bg-blue-100 text-blue-800"
      case "editor":
        return "bg-green-100 text-green-800"
      case "viewer":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const countByRole = (role: string) => {
    if (role === "all") return initialPads.length
    return initialPads.filter((pad) => pad.userRole === role).length
  }

  if (!mounted) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-full overflow-x-hidden">
        <div className="mb-6">
          <BreadcrumbNav
            items={[              
              { label: "Dashboard", href: "/dashboard" },
              { label: "Alliance Hub", href: "/paks" },
              { label: "My Pads", href: "/mypads", current: true },
            ]}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">My Pads</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search Pads..." value="" disabled className="pl-10 w-full sm:w-64 md:w-96" />
            </div>
            <UserMenu hideSettings={true} hideHowToSearch={true} />
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <CommunicationPaletteProvider>
    <div className="container mx-auto p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="mb-6">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Alliance Hub", href: "/paks" },
            { label: "My Pads", href: "/mypads", current: true },
          ]}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">My Pads</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search Pads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full sm:w-64 md:w-96"
            />
          </div>
          <CreatePadModal
            onPadCreated={(padId) => router.push(`/pads/${padId}`)}
            trigger={
              <Button className="bg-indigo-600 hover:bg-indigo-700 flex-shrink-0">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Create Pad</span>
              </Button>
            }
          />
          <UserMenu hideSettings={true} hideHowToSearch={true} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="flex w-full">
          <TabsTrigger value="all" className="flex-1 min-w-0 text-xs sm:text-sm px-1 sm:px-3">
            <span className="sm:hidden">All</span>
            <span className="hidden sm:inline">All ({countByRole("all")})</span>
          </TabsTrigger>
          <TabsTrigger value="owner" className="flex-1 min-w-0 text-xs sm:text-sm px-1 sm:px-3">
            <span className="sm:hidden">Own</span>
            <span className="hidden sm:inline">Owner ({countByRole("owner")})</span>
          </TabsTrigger>
          <TabsTrigger value="admin" className="flex-1 min-w-0 text-xs sm:text-sm px-1 sm:px-3">
            <span className="sm:hidden">Adm</span>
            <span className="hidden sm:inline">Admin ({countByRole("admin")})</span>
          </TabsTrigger>
          <TabsTrigger value="editor" className="flex-1 min-w-0 text-xs sm:text-sm px-1 sm:px-3">
            <span className="sm:hidden">Edit</span>
            <span className="hidden sm:inline">Editor ({countByRole("editor")})</span>
          </TabsTrigger>
          <TabsTrigger value="viewer" className="flex-1 min-w-0 text-xs sm:text-sm px-1 sm:px-3">
            <span className="sm:hidden">View</span>
            <span className="hidden sm:inline">Viewer ({countByRole("viewer")})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 w-full max-w-full overflow-hidden">
          {filteredPads.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full max-w-full">
              {filteredPads.map((pad) => (
                <Card
                  key={pad.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer w-full max-w-full min-w-0"
                  onClick={() => router.push(`/pads/${pad.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex-1 truncate">{pad.name}</span>
                      <Badge className={getRoleBadgeColor(pad.userRole)}>{pad.userRole}</Badge>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{pad.description || "No description"}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No Pads found</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}
