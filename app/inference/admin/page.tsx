"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Shield, Users, FileText, Trash2, Eye, Lock, Search, Archive, ArrowRight } from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import Link from "next/link"

type AdminRole = {
  id: string
  user_id: string
  role: string
  granted_at: string
  users: {
    id: string
    full_name: string
    email: string
    avatar_url: string
  }
}

type InferencePad = {
  id: string
  name: string
  description: string
  is_public: boolean
  owner_id: string
  created_at: string
  _count: { sticks: number; members: number }
}

type InferenceStick = {
  id: string
  topic: string
  content: string
  is_public: boolean
  created_at: string
  social_pads: { name: string }
  users: { full_name: string; email: string }
}

export default function InferenceHubAdminPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [admins] = useState<AdminRole[]>([])
  const [pads, setPads] = useState<InferencePad[]>([])
  const [sticks, setSticks] = useState<InferenceStick[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const isAdmin = user?.email === "chrisdoran63@outlook.com"

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth")
    }
    if (!loading && user && !isAdmin) {
      router.push("/inference")
    }
  }, [user, loading, router, isAdmin])

  useEffect(() => {
    if (user && isAdmin) {
      fetchAdminData()
    }
  }, [user, isAdmin])

  const fetchAdminData = async () => {
    try {
      setCurrentUserRole("global_admin")

      // Fetch all pads
      const padsRes = await fetch("/api/inference-pads?admin=true")
      const padsData = await padsRes.json()
      setPads(padsData.pads || [])

      // Fetch all sticks
      const sticksRes = await fetch("/api/inference-sticks?admin=true")
      const sticksData = await sticksRes.json()
      setSticks(sticksData.sticks || [])
    } catch (error) {
      console.error("Error fetching admin data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const togglePadVisibility = async (padId: string, isPublic: boolean) => {
    try {
      await fetch(`/api/inference-pads/${padId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !isPublic }),
      })
      fetchAdminData()
    } catch (error) {
      console.error("Error toggling pad visibility:", error)
    }
  }

  const deletePad = async (padId: string) => {
    if (!confirm("Are you sure you want to delete this pad? This will also delete all sticks in it.")) return

    try {
      await fetch(`/api/inference-pads/${padId}`, { method: "DELETE" })
      fetchAdminData()
    } catch (error) {
      console.error("Error deleting pad:", error)
    }
  }

  const deleteStick = async (stickId: string) => {
    if (!confirm("Are you sure you want to delete this stick?")) return

    try {
      await fetch(`/api/inference-sticks/${stickId}`, { method: "DELETE" })
      fetchAdminData()
    } catch (error) {
      console.error("Error deleting stick:", error)
    }
  }

  const filteredPads = pads.filter((pad) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return pad.name.toLowerCase().includes(query) || pad.description?.toLowerCase().includes(query)
  })

  const filteredSticks = sticks.filter((stick) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      stick.topic?.toLowerCase().includes(query) ||
      stick.content?.toLowerCase().includes(query) ||
      stick.social_pads?.name?.toLowerCase().includes(query)
    )
  })

  const roleColors: Record<string, string> = {
    global_admin: "bg-red-500",
    social_hub_admin: "bg-blue-500",
    verified_admin: "bg-green-500",
    network_admin: "bg-purple-500",
    answers_admin: "bg-yellow-500",
    corporate_communicator: "bg-pink-500",
    community_admin: "bg-indigo-500",
  }

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Inference Hub", href: "/inference" },
            { label: "Administration", current: true },
          ]}
        />
        <UserMenu />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Inference Hub Administration</h1>
        </div>
        <p className="text-muted-foreground">Manage Inference Hub settings, content, and administrators</p>
        {currentUserRole && (
          <Badge className={`mt-2 ${roleColors[currentUserRole]}`}>
            {currentUserRole.replaceAll("_", " ").toUpperCase()}
          </Badge>
        )}
      </div>

      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Archive className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold">Cleanup Policies Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  Manage automatic archiving and deletion rules for all pads
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/inference/admin/cleanup-policies">
                Open Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search pads and sticks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {searchQuery && (
          <p className="text-sm text-muted-foreground mt-2">
            Found {filteredPads.length} pad(s) and {filteredSticks.length} stick(s)
          </p>
        )}
      </div>

      <Tabs defaultValue="pads" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pads">
            <FileText className="h-4 w-4 mr-2" />
            Inference Pads ({filteredPads.length})
          </TabsTrigger>
          <TabsTrigger value="sticks">
            <FileText className="h-4 w-4 mr-2" />
            Inference Sticks ({filteredSticks.length})
          </TabsTrigger>
          <TabsTrigger value="admins">
            <Users className="h-4 w-4 mr-2" />
            Administrators ({admins.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pads" className="space-y-4">
          {filteredPads.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {searchQuery ? "No pads found matching your search" : "No pads available"}
              </CardContent>
            </Card>
          ) : (
            filteredPads.map((pad) => (
              <Card key={pad.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{pad.name}</CardTitle>
                      <CardDescription>{pad.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => togglePadVisibility(pad.id, pad.is_public)}>
                        {pad.is_public ? <Eye className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deletePad(pad.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{pad._count?.sticks || 0} sticks</span>
                    <span>{pad._count?.members || 0} members</span>
                    <Badge variant={pad.is_public ? "default" : "secondary"}>
                      {pad.is_public ? "Public" : "Private"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sticks" className="space-y-4">
          {filteredSticks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {searchQuery ? "No sticks found matching your search" : "No sticks available"}
              </CardContent>
            </Card>
          ) : (
            filteredSticks.map((stick) => (
              <Card key={stick.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{stick.topic}</CardTitle>
                      <CardDescription>{stick.content.substring(0, 100)}...</CardDescription>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => deleteStick(stick.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Pad: {stick.social_pads?.name}</span>
                    <span>By: {stick.users?.full_name || stick.users?.email}</span>
                    <Badge variant={stick.is_public ? "default" : "secondary"}>
                      {stick.is_public ? "Public" : "Private"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="admins" className="space-y-4">
          {admins.map((admin) => (
            <Card key={admin.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{admin.users.full_name}</CardTitle>
                      <CardDescription>{admin.users.email}</CardDescription>
                    </div>
                  </div>
                  <Badge className={roleColors[admin.role]}>{admin.role.replaceAll("_", " ").toUpperCase()}</Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
