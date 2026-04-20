"use client"

import { useState, useMemo, useEffect, Fragment } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { StickMapButton } from "@/components/stick-map/StickMapButton"
import { SubStickMenuButton } from "@/components/SubStickMenuButton"
import { CreateStickModal } from "@/components/create-stick-modal"
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
  const searchParams = useSearchParams()
  const stickIdParam = searchParams.get("stick")
  const [sticks, setSticks] = useState<StickWithRole[]>(initialSticks)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [mounted, setMounted] = useState(false)
  const [selectedStick, setSelectedStick] = useState<StickWithRole | null>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatStickTopic, setChatStickTopic] = useState("")
  // Families are hidden by default; users toggle from any parent card.
  const [showSubSticks, setShowSubSticks] = useState(false)
  const [subStickParent, setSubStickParent] = useState<StickWithRole | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-open a stick from ?stick= URL param (e.g. linked from Noted "Go to Stick")
  useEffect(() => {
    if (!stickIdParam || isFullscreenOpen) return
    const target = sticks.find((s) => s.id === stickIdParam)
    if (target) {
      setSelectedStick(target)
      setIsFullscreenOpen(true)
    }
  }, [stickIdParam, sticks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Parents only — filtered by search + tab. Sub-sticks are reintroduced by
  // displaySticks when family mode is on. Sub-sticks never appear standalone.
  const filteredParents = useMemo(() => {
    return sticks.filter((stick) => {
      if (stick.parent_stick_id) return false
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

  const subSticksByParent = useMemo(() => {
    const map = new Map<string, StickWithRole[]>()
    for (const s of sticks) {
      if (!s.parent_stick_id) continue
      const arr = map.get(s.parent_stick_id) ?? []
      arr.push(s)
      map.set(s.parent_stick_id, arr)
    }
    return map
  }, [sticks])

  const displaySticks = useMemo(() => {
    if (!showSubSticks) return filteredParents
    const result: StickWithRole[] = []
    for (const parent of filteredParents) {
      const children = subSticksByParent.get(parent.id)
      if (!children || children.length === 0) continue
      result.push(parent, ...children)
    }
    return result
  }, [showSubSticks, filteredParents, subSticksByParent])

  // Back-compat: countByRole() and the empty-state check still use the full
  // filtered list ignoring family mode, so tab counts stay stable.
  const filteredSticks = filteredParents

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
    // If the user arrived here from Noted's "Go to Stick" (new tab), close the
    // tab on X. window.close() only works for script-opened tabs, so fall back
    // to clearing the URL param when it's blocked.
    if (searchParams.get("from") === "noted") {
      window.close()
    }
    // Clear the ?stick= param so the effect doesn't reopen the fullscreen
    if (stickIdParam) {
      router.replace("/mysticks")
    }
  }

  const handleChatClick = (e: React.MouseEvent, stickTopic: string) => {
    e.stopPropagation()
    setChatStickTopic(stickTopic || "Untitled Stick")
    setChatModalOpen(true)
  }

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open("/video", "_blank", "noopener,noreferrer")
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
          {showSubSticks && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
              <span className="text-sm font-medium text-amber-900">Showing Sub Sticks</span>
              <span className="text-xs text-amber-700">— families only</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSubSticks(false)}
                className="h-6 ml-auto text-xs text-amber-900 hover:bg-amber-100"
              >
                Show All Sticks
              </Button>
            </div>
          )}
          {displaySticks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full max-w-full">
              {displaySticks.map((stick) => {
                const isSubStick = Boolean(stick.parent_stick_id)
                const hasSubSticks = !isSubStick && (subSticksByParent.get(stick.id)?.length ?? 0) > 0
                const canEdit = stick.userRole === "owner" || stick.userRole === "admin" || stick.userRole === "edit"
                const cardStyle: React.CSSProperties = isSubStick
                  ? {
                      borderColor: stick.color || "#d1d5db",
                      borderTopWidth: "2px",
                      borderRightWidth: "2px",
                      borderBottomWidth: "2px",
                      borderLeftWidth: "8px",
                      borderStyle: "solid",
                    }
                  : {}
                return (
                  <Fragment key={stick.id}>
                    <Card
                      className={`hover:shadow-lg transition-shadow cursor-pointer bg-white w-full max-w-full min-w-0 ${
                        isSubStick ? "" : "border-2 border-gray-300"
                      }`}
                      style={cardStyle}
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
                                openInNewTab
                              />
                            </span>
                            <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="none">
                              <StickMapButton
                                stickId={stick.id}
                                stickTopic={stick.topic}
                                stickContent={stick.content}
                                stickColor={stick.color}
                                isPersonal={!stick.pad_id}
                                className="h-7 w-7 p-0"
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
                            {!isSubStick && canEdit && stick.pad_id && (
                              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="none">
                                <SubStickMenuButton
                                  hasSubSticks={hasSubSticks}
                                  isShowingSubSticks={showSubSticks}
                                  onCreateSubStick={() => setSubStickParent(stick)}
                                  onToggleShowSubSticks={() => setShowSubSticks((prev) => !prev)}
                                  indicatorColor={stick.color}
                                />
                              </span>
                            )}
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
                  </Fragment>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {showSubSticks ? "No sticks with sub sticks match the current filters." : "No Sticks found"}
              </p>
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
          stickType={selectedStick.pad_id ? "alliance" : "personal"}
        />
      )}

      {/* Chat Modal */}
      <CreateChatModal
        open={chatModalOpen}
        onOpenChange={setChatModalOpen}
        defaultName={chatStickTopic}
        autoSubmit
        openInNewTab
      />

      {/* Sub-stick create: reuses CreateStickModal in sub-stick mode. Only
          reachable from a parent with a pad_id (personal sticks without a pad
          don't need this path — they use /personal). */}
      {subStickParent?.pad_id && (
        <CreateStickModal
          isOpen={subStickParent !== null}
          onClose={() => {
            setSubStickParent(null)
            router.refresh()
          }}
          padId={subStickParent.pad_id}
          parentStickId={subStickParent.id}
          parentColor={subStickParent.color}
        />
      )}

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}
