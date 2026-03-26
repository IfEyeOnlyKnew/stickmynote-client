"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { StickWithRole } from "@/lib/data/sticks-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, FileText, MessagesSquare, Video } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionBasedStickFullscreen } from "@/components/permission-based/PermissionBasedStickFullscreen"
import { CreateChatModal } from "@/components/stick-chats/CreateChatModal"
import { Button } from "@/components/ui/button"
import { NotedIcon } from "@/components/noted/NotedIcon"
import type { Stick } from "@/types/pad"
import {
  CommunicationPaletteProvider,
  CommunicationModals,
} from "@/components/communication"

interface MySticksClientProps {
  readonly initialSticks: StickWithRole[]
}

export function MySticksClient({ initialSticks }: MySticksClientProps) {
  const router = useRouter()
  const [sticks, setSticks] = useState<StickWithRole[]>(initialSticks)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [mounted, setMounted] = useState(false)
  const [selectedStick, setSelectedStick] = useState<StickWithRole | null>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatStickTopic, setChatStickTopic] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredSticks = useMemo(() => {
    return sticks.filter((stick) => {
      const matchesSearch =
        (stick.topic || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (stick.content || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (stick.pad_name || "").toLowerCase().includes(searchQuery.toLowerCase())

      const matchesTab =
        activeTab === "all" ||
        (activeTab === "owner" && stick.userRole === "owner") ||
        (activeTab === "admin" && stick.userRole === "admin") ||
        (activeTab === "edit" && stick.userRole === "edit") ||
        (activeTab === "view" && stick.userRole === "view")

      return matchesSearch && matchesTab
    })
  }, [sticks, searchQuery, activeTab])

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800"
      case "admin":
        return "bg-blue-100 text-blue-800"
      case "edit":
        return "bg-green-100 text-green-800"
      case "view":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const countByRole = (role: string) => {
    if (role === "all") return sticks.length
    return sticks.filter((stick) => stick.userRole === role).length
  }

  const handleStickClick = (stick: StickWithRole) => {
    if (stick.pad_id) {
      setSelectedStick(stick)
      setIsFullscreenOpen(true)
    } else {
      router.push("/personal")
    }
  }

  const handleCloseFullscreen = () => {
    setIsFullscreenOpen(false)
    setSelectedStick(null)
  }

  const handleChatClick = (e: React.MouseEvent, stickTopic: string) => {
    e.stopPropagation()
    setChatStickTopic(stickTopic || "Untitled Stick")
    setChatModalOpen(true)
  }

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push("/video")
  }

  const handleUpdateStick = (updatedStick: Stick) => {
    setSticks((prevSticks) =>
      prevSticks.map((stick) => {
        if (stick.id === updatedStick.id) {
          return {
            ...stick,
            ...updatedStick,
          }
        }
        return stick
      }),
    )
  }

  const handleDeleteStick = (stickId: string) => {
    setSticks((prevSticks) => prevSticks.filter((stick) => stick.id !== stickId))
    handleCloseFullscreen()
  }

  const getPermissions = (role: string) => {
    return {
      canView: true,
      canEdit: role === "owner" || role === "admin" || role === "edit",
      canAdmin: role === "owner" || role === "admin",
    }
  }

  if (!mounted) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-full overflow-x-hidden">
        <div className="mb-6">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Alliance Hub", href: "/paks" },
              { label: "My Sticks", href: "/mysticks", current: true },
            ]}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">My Sticks</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search Sticks..." value="" disabled className="pl-10 w-full sm:w-48 md:w-64" />
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
            { label: "My Sticks", href: "/mysticks", current: true },
          ]}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">My Sticks</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search Sticks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full sm:w-48 md:w-64"
            />
          </div>
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
          <TabsTrigger value="edit" className="flex-1 min-w-0 text-xs sm:text-sm px-1 sm:px-3">
            <span className="sm:hidden">Edit</span>
            <span className="hidden sm:inline">Edit ({countByRole("edit")})</span>
          </TabsTrigger>
          <TabsTrigger value="view" className="flex-1 min-w-0 text-xs sm:text-sm px-1 sm:px-3">
            <span className="sm:hidden">View</span>
            <span className="hidden sm:inline">View ({countByRole("view")})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 w-full max-w-full overflow-hidden">
          {filteredSticks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full max-w-full">
              {filteredSticks.map((stick) => (
                <Card
                  key={stick.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer bg-white border-2 border-gray-300 w-full max-w-full min-w-0"
                  onClick={() => handleStickClick(stick)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="flex-1 truncate text-base">{stick.topic || "Untitled Stick"}</span>
                      <div className="flex items-center gap-1">
                        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="none">
                          <NotedIcon
                            stickId={stick.id}
                            stickTopic={stick.topic}
                            stickContent={stick.content}
                            isPersonal={!stick.pad_id}
                            size="sm"
                          />
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => handleChatClick(e, stick.topic)}
                          title="New chat"
                        >
                          <MessagesSquare className="h-4 w-4 text-purple-500 hover:text-purple-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={handleVideoClick}
                          title="Start video call"
                        >
                          <Video className="h-4 w-4 text-blue-500 hover:text-blue-600" />
                        </Button>
                        <Badge className={getRoleBadgeColor(stick.userRole)}>{stick.userRole}</Badge>
                      </div>
                    </CardTitle>
                    <CardDescription className="line-clamp-3">{stick.content || "No content"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2 text-sm text-gray-500">
                      {stick.pad_name && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="truncate">Pad: {stick.pad_name}</span>
                        </div>
                      )}
                      {!stick.pad_id && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Personal Stick</Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No Sticks found</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedStick && isFullscreenOpen && (
        <PermissionBasedStickFullscreen
          stick={selectedStick}
          permissions={getPermissions(selectedStick.userRole)}
          onClose={handleCloseFullscreen}
          onUpdate={handleUpdateStick}
          onDelete={handleDeleteStick}
        />
      )}

      {/* Chat Modal */}
      <CreateChatModal
        open={chatModalOpen}
        onOpenChange={setChatModalOpen}
        defaultName={chatStickTopic}
        autoSubmit
      />

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}
