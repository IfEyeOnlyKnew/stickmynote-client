"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CsvEmailUpload } from "@/components/csv-email-upload"
import { AccountsManager } from "@/components/inference/accounts-manager"
import { AdminManager } from "@/components/inference/admin-manager"
import {
  Settings,
  Globe,
  Lock,
  Users,
  UserPlus,
  Trash2,
  Shield,
  FileText,
  Save,
  ArrowLeft,
  Building2,
  UserIcon,
} from "lucide-react"

interface InferencePad {
  id: string
  name: string
  description: string
  owner_id: string
  is_public: boolean
  created_at: string
  stick_count?: number
  hub_type?: string
  hub_email?: string
}

interface Member {
  id: string
  user_id: string
  role: string
  accepted: boolean
  users: {
    id: string
    full_name: string | null
    username: string | null
    email: string
    avatar_url: string | null
  }
}

export default function EditPadPage() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const params = useParams()
  const padId = params.padId as string

  const [pad, setPad] = useState<InferencePad | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [inviting, setInviting] = useState(false)
  const [bulkEmails, setBulkEmails] = useState("")

  useEffect(() => {
    if (padId) {
      fetchPadData()
      fetchMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padId])

  const fetchPadData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/inference-pads/${padId}`)
      if (response.ok) {
        const data = await response.json()
        setPad(data.pad)
        setName(data.pad.name)
        setDescription(data.pad.description || "")
        setIsPublic(data.pad.is_public)
        setIsOwner(user?.id === data.pad.owner_id)
      } else {
        router.push("/inference")
      }
    } catch (error) {
      console.error("Error fetching pad:", error)
      router.push("/inference")
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/inference-pads/${padId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
        setIsOwner(data.isOwner || false)
      }
    } catch (error) {
      console.error("Error fetching members:", error)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return

    try {
      setSaving(true)
      const response = await fetch(`/api/inference-pads/${padId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          is_public: isPublic,
        }),
      })

      if (response.ok) {
        router.push(`/inference/pads/${padId}`)
      } else {
        const data = await response.json()
        alert(data.error || "Failed to update pad")
      }
    } catch (error) {
      console.error("Error updating pad:", error)
      alert("Failed to update pad")
    } finally {
      setSaving(false)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return

    try {
      setInviting(true)
      const response = await fetch(`/api/inference-pads/${padId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      if (response.ok) {
        setInviteEmail("")
        setInviteRole("member")
        fetchMembers()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to invite member")
      }
    } catch (error) {
      console.error("Error inviting member:", error)
      alert("Failed to invite member")
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/inference-pads/${padId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          role: newRole,
        }),
      })

      if (response.ok) {
        fetchMembers()
      }
    } catch (error) {
      console.error("Error updating role:", error)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return

    try {
      const response = await fetch(`/api/inference-pads/${padId}/members?memberId=${memberId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchMembers()
      }
    } catch (error) {
      console.error("Error removing member:", error)
    }
  }

  const handleCsvUpload = async (emails: Array<{ email: string; name?: string }>) => {
    try {
      setInviting(true)
      const emailList = emails.map((e) => e.email)

      const response = await fetch(`/api/inference-pads/${padId}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: emailList,
          role: inviteRole,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const skippedMsg = data.skipped ? ` (${data.skipped} already members)` : ""
        alert(`Successfully invited ${data.added || 0} members${skippedMsg}`)
        fetchMembers()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to invite members")
      }
    } catch (error) {
      console.error("Error inviting members:", error)
      alert("Failed to invite members")
    } finally {
      setInviting(false)
    }
  }

  const handleBulkInvite = async () => {
    if (!bulkEmails.trim()) return

    const emails = bulkEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

    if (emails.length === 0) {
      alert("No valid emails found. Please check the format.")
      return
    }

    try {
      setInviting(true)
      const response = await fetch(`/api/inference-pads/${padId}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          role: inviteRole,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const skippedMsg = data.skipped ? ` (${data.skipped} already members)` : ""
        alert(`Successfully invited ${data.added || 0} members${skippedMsg}`)
        setBulkEmails("")
        fetchMembers()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to invite members")
      }
    } catch (error) {
      console.error("Error inviting members:", error)
      alert("Failed to invite members")
    } finally {
      setInviting(false)
    }
  }

  const getDisplayName = (member: Member) => {
    return member.users.full_name || member.users.username || member.users.email
  }

  const getInitials = (member: Member) => {
    const name = member.users.full_name || member.users.username || member.users.email
    return name.substring(0, 2).toUpperCase()
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default"
      case "admin":
        return "secondary"
      default:
        return "outline"
    }
  }

  // Computed values for template simplification
  const isHubType = pad?.hub_type && pad.hub_type !== "regular"
  const settingsTitle = isHubType ? "Hub Administration" : "Edit Pad Settings"
  const settingsDescription = isHubType 
    ? "Manage your inference hub settings, accounts, admins, and members" 
    : "Manage your inference pad settings, members, and permissions"
  const nameLabel = isHubType ? "Hub Name" : "Pad Name"

  const getHubTypeDisplay = () => {
    if (!isHubType) return null

    const isIndividual = pad?.hub_type === "individual"
    const Icon = isIndividual ? UserIcon : Building2
    const iconColorClass = isIndividual ? "text-purple-600" : "text-blue-600"
    const hubTypeLabel = isIndividual ? "Individual Hub" : "Organization Hub"

    return (
      <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
        <Icon className={`h-5 w-5 ${iconColorClass}`} />
        <div>
          <p className="font-semibold text-sm">{hubTypeLabel}</p>
          {pad?.hub_email && <p className="text-xs text-gray-600">{pad.hub_email}</p>}
        </div>
      </div>
    )
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent" />
          <p className="text-purple-600 font-medium">Loading pad settings...</p>
        </div>
      </div>
    )
  }

  if (!user || !pad || !isOwner) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-purple-100 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Inference Hub", href: "/inference" },
              { label: pad.name, href: `/inference/pads/${padId}` },
              { label: "Edit", current: true },
            ]}
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl inference-gradient flex items-center justify-center shadow-lg">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {settingsTitle}
                </h1>
                <p className="text-sm text-gray-600">{pad.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.push(`/inference/pads/${padId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pad
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card className="border-0 shadow-xl">
          <CardHeader className="bg-gradient-to-br from-gray-50 to-white border-b">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {settingsTitle}
            </CardTitle>
            <CardDescription>{settingsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="admins">Admins</TabsTrigger>
                <TabsTrigger value="accounts">Accounts</TabsTrigger>
                <TabsTrigger value="invite">Invite</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6 mt-6">
                {getHubTypeDisplay()}

                <div className="space-y-2">
                  <Label htmlFor="pad-name">{nameLabel} *</Label>
                  <Input
                    id="pad-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    placeholder="e.g., Marketing Team, Product Ideas"
                    className="text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pad-description">Description</Label>
                  <Textarea
                    id="pad-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="What's this pad about?"
                    className="resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                        <Globe className="h-6 w-6 text-white" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                        <Lock className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="public-toggle" className="text-base font-semibold text-gray-900 cursor-pointer">
                        {isPublic ? "Public Pad" : "Private Pad"}
                      </Label>
                      <p className="text-sm text-gray-600">
                        {isPublic ? "Anyone can discover and view this pad" : "Only you and invited members can access"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="public-toggle"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => router.push(`/inference/pads/${padId}`)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={!name.trim() || saving} className="inference-gradient text-white">
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="members" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Current Members
                    </h3>
                    <Badge variant="secondary" className="text-sm">
                      {members.length} {members.length === 1 ? "member" : "members"}
                    </Badge>
                  </div>

                  {members.length === 0 ? (
                    <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-dashed border-gray-200">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600 font-medium mb-2">No members yet</p>
                      <p className="text-sm text-gray-500">Invite team members to collaborate on this pad</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {members.map((member) => (
                        <Card key={member.id} className="border shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                  {member.users.avatar_url && (
                                    <AvatarImage
                                      src={member.users.avatar_url || "/placeholder.svg"}
                                      alt={getDisplayName(member)}
                                    />
                                  )}
                                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                                    {getInitials(member)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold">{getDisplayName(member)}</p>
                                  <p className="text-sm text-gray-500">{member.users.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {member.role === "owner" ? (
                                  <Badge variant={getRoleBadgeVariant(member.role)} className="px-3 py-1">
                                    {member.role}
                                  </Badge>
                                ) : (
                                  <Select
                                    value={member.role}
                                    onValueChange={(value) => handleUpdateRole(member.id, value)}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="member">Member</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                                {member.role !== "owner" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">Permission Levels</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p>
                      <strong>Owner:</strong> Full control - can do everything including deleting the pad
                    </p>
                    <p>
                      <strong>Admin:</strong> Same permissions as Owner except cannot delete the pad
                    </p>
                    <p>
                      <strong>Member:</strong> Can only reply to sticks (read-only for pad/stick content)
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="admins" className="mt-6">
                <AdminManager padId={padId} currentUserId={user.id} isOwner={isOwner} />
              </TabsContent>

              <TabsContent value="accounts" className="mt-6">
                <AccountsManager />
              </TabsContent>

              <TabsContent value="invite" className="space-y-6 mt-6">
                <div className="space-y-6">
                  <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Invite Member by Email
                      </CardTitle>
                      <CardDescription>Add a single member to this pad</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select Role</Label>
                        <Select
                          value={inviteRole}
                          onValueChange={(value) => setInviteRole(value as "admin" | "member")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin - Same permissions as Owner</SelectItem>
                            <SelectItem value="member">Member - Can only reply to sticks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter email address"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          type="email"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleInviteMember()
                            }
                          }}
                        />
                        <Button
                          onClick={handleInviteMember}
                          disabled={!inviteEmail.trim() || inviting}
                          className="inference-gradient text-white"
                        >
                          {inviting ? "Inviting..." : "Invite"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Bulk Invite via CSV
                      </CardTitle>
                      <CardDescription>Upload a CSV file with email addresses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CsvEmailUpload onEmailsUploaded={handleCsvUpload} />
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-green-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Bulk Invite via Text
                      </CardTitle>
                      <CardDescription>Paste multiple email addresses</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="bulk-emails">Email Addresses</Label>
                        <textarea
                          id="bulk-emails"
                          value={bulkEmails}
                          onChange={(e) => setBulkEmails(e.target.value)}
                          placeholder="Enter emails separated by commas, semicolons, or new lines&#10;example@email.com, another@email.com&#10;third@email.com"
                          className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md resize-vertical focus:border-purple-500 focus:ring-purple-500"
                          rows={5}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Separate emails with commas, semicolons, or new lines
                        </p>
                      </div>
                      <Button
                        onClick={handleBulkInvite}
                        disabled={!bulkEmails.trim() || inviting}
                        className="inference-gradient text-white"
                      >
                        {inviting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                            Inviting...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Invite All
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
