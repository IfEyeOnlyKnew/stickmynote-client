"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Users, MessageCircle, Clock, ChevronRight, Plus } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { CreateConcurGroupDialog } from "@/components/concur/create-concur-group-dialog"

interface ConcurGroup {
  id: string
  name: string
  description: string | null
  member_count: number
  stick_count: number
  user_role: string
  latest_activity: string
  created_at: string
}

export default function ConcurPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<ConcurGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/concur/groups")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setGroups(data.groups || [])
      setIsAdmin(data.isConcurAdmin || false)
    } catch (error) {
      console.error("Failed to fetch Concur groups:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <BreadcrumbNav
                items={[
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "Concur Groups" },
                ]}
              />
              <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
                <MessageCircle className="h-6 w-6 text-indigo-600" />
                Concur Groups
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Group
                </Button>
              )}
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold text-muted-foreground">No Concur Groups</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {isAdmin
                ? "Create your first Concur group using the button above."
                : <>You haven&apos;t been added to any Concur groups yet. <br />Contact your organization administrator to get started.</>
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all duration-200"
                onClick={() => router.push(`/concur/${group.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{group.name}</CardTitle>
                      {group.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {group.description}
                        </CardDescription>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{group.member_count} member{group.member_count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      <span>{group.stick_count} stick{group.stick_count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      group.user_role === "owner"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}>
                      {group.user_role}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(group.latest_activity), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreateDialog && (
        <CreateConcurGroupDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => { setShowCreateDialog(false); fetchGroups() }}
        />
      )}
    </div>
  )
}
