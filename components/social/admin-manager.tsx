"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, ShieldCheck, User, Trash2, Loader2, Crown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Member {
  id: string
  user_id: string
  role: string
  admin_level: string
  users: {
    email: string
    full_name: string | null
    username: string | null
  }
}

interface AdminManagerProps {
  padId: string
  currentUserId: string
  isOwner: boolean
}

export function AdminManager({ padId, currentUserId, isOwner }: AdminManagerProps) {
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    fetchMembers()
  }, [padId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/social-pads/${padId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error("Error fetching members:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePromoteToAdmin = async (memberId: string) => {
    if (!isOwner) {
      toast({ title: "Error", description: "Only owners can promote members to admin", variant: "destructive" })
      return
    }

    setUpdating(memberId)
    try {
      const response = await fetch(`/api/social-pads/${padId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_level: "admin" }),
      })

      if (response.ok) {
        toast({ title: "Member promoted to admin" })
        fetchMembers()
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to promote member", variant: "destructive" })
    } finally {
      setUpdating(null)
    }
  }

  const handleDemoteToMember = async (memberId: string) => {
    if (!isOwner) {
      toast({ title: "Error", description: "Only owners can demote admins", variant: "destructive" })
      return
    }

    setUpdating(memberId)
    try {
      const response = await fetch(`/api/social-pads/${padId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_level: "member" }),
      })

      if (response.ok) {
        toast({ title: "Admin demoted to member" })
        fetchMembers()
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to demote admin", variant: "destructive" })
    } finally {
      setUpdating(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!isOwner) {
      toast({ title: "Error", description: "Only owners can remove members", variant: "destructive" })
      return
    }

    if (!confirm("Are you sure you want to remove this member?")) return

    setUpdating(memberId)
    try {
      const response = await fetch(`/api/social-pads/${padId}/members/${memberId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({ title: "Member removed successfully" })
        fetchMembers()
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" })
    } finally {
      setUpdating(null)
    }
  }

  const getAdminLevelBadge = (adminLevel: string) => {
    switch (adminLevel) {
      case "owner":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Crown className="h-3 w-3 mr-1" />
            Owner
          </Badge>
        )
      case "admin":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <User className="h-3 w-3 mr-1" />
            Member
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const owners = members.filter((m) => m.admin_level === "owner")
  const admins = members.filter((m) => m.admin_level === "admin")
  const regularMembers = members.filter((m) => m.admin_level === "member")

  return (
    <div className="space-y-6">
      {/* Owners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            Owners ({owners.length})
          </CardTitle>
          <CardDescription>Full control over the hub and all settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {owners.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50">
                <div className="flex-1">
                  <div className="font-medium">{member.users.full_name || member.users.username || "Unknown"}</div>
                  <div className="text-sm text-gray-600">{member.users.email}</div>
                </div>
                {getAdminLevelBadge(member.admin_level)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admins */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Admins ({admins.length})
          </CardTitle>
          <CardDescription>Can manage members and moderate content</CardDescription>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No admins yet. Promote members below.</p>
          ) : (
            <div className="space-y-2">
              {admins.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{member.users.full_name || member.users.username || "Unknown"}</div>
                    <div className="text-sm text-gray-600">{member.users.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getAdminLevelBadge(member.admin_level)}
                    {isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDemoteToMember(member.id)}
                        disabled={updating === member.id}
                      >
                        {updating === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Demote to Member"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regular Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Members ({regularMembers.length})
          </CardTitle>
          <CardDescription>Standard access to hub content</CardDescription>
        </CardHeader>
        <CardContent>
          {regularMembers.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No regular members yet.</p>
          ) : (
            <div className="space-y-2">
              {regularMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{member.users.full_name || member.users.username || "Unknown"}</div>
                    <div className="text-sm text-gray-600">{member.users.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getAdminLevelBadge(member.admin_level)}
                    {isOwner && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePromoteToAdmin(member.id)}
                          disabled={updating === member.id}
                        >
                          {updating === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-1" />
                              Promote to Admin
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={updating === member.id}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!isOwner && <p className="text-sm text-gray-500 text-center">Only owners can manage admin permissions</p>}
    </div>
  )
}
