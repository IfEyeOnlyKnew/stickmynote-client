"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from 'next/navigation'
import type { PadWithRole } from "@/lib/data/pads-data"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from 'lucide-react'
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <BreadcrumbNav
            items={[              
              { label: "Dashboard", href: "/dashboard" },
              { label: "Paks-Hub", href: "/paks" },
              { label: "My Pads", href: "/mypads", current: true },
            ]}
          />
        </div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Pads</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search Pads..." value="" disabled className="pl-10 w-96" />
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
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <BreadcrumbNav
          items={[            
            { label: "Dashboard", href: "/dashboard" },
            { label: "Paks-Hub", href: "/paks" },
            { label: "My Pads", href: "/mypads", current: true },
          ]}
        />
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Pads</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search Pads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-96"
            />
          </div>
          <UserMenu hideSettings={true} hideHowToSearch={true} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({countByRole("all")})</TabsTrigger>
          <TabsTrigger value="owner">Owner ({countByRole("owner")})</TabsTrigger>
          <TabsTrigger value="admin">Admin ({countByRole("admin")})</TabsTrigger>
          <TabsTrigger value="editor">Editor ({countByRole("editor")})</TabsTrigger>
          <TabsTrigger value="viewer">Viewer ({countByRole("viewer")})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredPads.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPads.map((pad) => (
                <Card
                  key={pad.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
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
    </div>
  )
}
