"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserPlus, Trash2, Shield, FileText, Mail, Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CsvEmailUpload } from "@/components/csv-email-upload"

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
    hourly_rate_cents?: number
  } | null
}

interface PendingInvite {
  id: string
  email: string
  role: string
  invited_at: string
}

interface ManageMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  padId: string
  padName: string
}

export function ManageMembersDialog({ open, onOpenChange, padId, padName }: ManageMembersDialogProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer")
  const [inviting, setInviting] = useState(false)
  const [activeTab, setActiveTab] = useState("invite")
  const [bulkEmails, setBulkEmails] = useState("")
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (open && padId) {
      fetchMembers()
      fetchPendingInvites()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, padId])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/social-pads/${padId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
        setIsOwner(data.isOwner || false)
      }
    } catch (error) {
      console.error("Error fetching members:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingInvites = async () => {
    try {
      const response = await fetch(`/api/social-pads/${padId}/pending-invites`)
      if (response.ok) {
        const data = await response.json()
        setPendingInvites(data.pendingInvites || [])
      } else {
        console.log("[v0] Could not fetch pending invites, setting empty array")
        setPendingInvites([])
      }
    } catch (error) {
      console.error("[v0] Error fetching pending invites:", error)
      // Don't break the UI if pending invites can't be fetched
      setPendingInvites([])
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return

    try {
      setInviting(true)
      setFeedbackMessage(null)
      const response = await fetch(`/api/social-pads/${padId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setInviteEmail("")
        setInviteRole("viewer") // Reset to viewer instead of member

        if (data.userExists) {
          setFeedbackMessage({
            type: "success",
            text: `${inviteEmail} has been added to the pad and notified via email.`,
          })
        } else {
          setFeedbackMessage({
            type: "success",
            text: `Invitation sent to ${inviteEmail}. They will be added when they sign up.`,
          })
        }

        fetchMembers()
        fetchPendingInvites()
      } else {
        setFeedbackMessage({ type: "error", text: data.error || "Failed to invite member" })
      }
    } catch (error) {
      console.error("Error inviting member:", error)
      setFeedbackMessage({ type: "error", text: "Failed to invite member" })
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/social-pads/${padId}/members`, {
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

  const handleUpdateRate = async (memberId: string, rate: string) => {
    const rateCents = Math.round(Number.parseFloat(rate) * 100)
    if (isNaN(rateCents)) return

    try {
      const response = await fetch(`/api/social-pads/${padId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          hourlyRateCents: rateCents,
        }),
      })

      if (response.ok) {
        fetchMembers()
      }
    } catch (error) {
      console.error("Error updating rate:", error)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return

    try {
      const response = await fetch(`/api/social-pads/${padId}/members?memberId=${memberId}`, {
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
      setFeedbackMessage(null)
      const emailList = emails.map((e) => e.email)

      const response = await fetch(`/api/social-pads/${padId}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: emailList,
          role: inviteRole,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFeedbackMessage({
          type: "success",
          text: data.message || `Successfully processed ${emails.length} email(s)`,
        })
        fetchMembers()
        fetchPendingInvites()
        setActiveTab("invite")
      } else {
        const data = await response.json()
        setFeedbackMessage({ type: "error", text: data.error || "Failed to invite members" })
      }
    } catch (error) {
      console.error("Error inviting members:", error)
      setFeedbackMessage({ type: "error", text: "Failed to invite members" })
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
      setFeedbackMessage({ type: "error", text: "No valid emails found. Please check the format." })
      return
    }

    try {
      setInviting(true)
      setFeedbackMessage(null)
      const response = await fetch(`/api/social-pads/${padId}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          role: inviteRole,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFeedbackMessage({
          type: "success",
          text: data.message || `Successfully processed ${emails.length} email(s)`,
        })
        setBulkEmails("")
        fetchMembers()
        fetchPendingInvites()
        setActiveTab("invite")
      } else {
        const data = await response.json()
        setFeedbackMessage({ type: "error", text: data.error || "Failed to invite members" })
      }
    } catch (error) {
      console.error("Error inviting members:", error)
      setFeedbackMessage({ type: "error", text: "Failed to invite members" })
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return

    try {
      const response = await fetch(`/api/social-pads/${padId}/pending-invites?inviteId=${inviteId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchPendingInvites()
        setFeedbackMessage({ type: "success", text: "Invitation cancelled successfully" })
      }
    } catch (error) {
      console.error("Error cancelling invite:", error)
      setFeedbackMessage({ type: "error", text: "Failed to cancel invitation" })
    }
  }

  const getDisplayName = (member: Member) => {
    if (!member.users) return "Unknown User"
    return member.users.full_name || member.users.username || member.users.email || "Unknown User"
  }

  const getInitials = (member: Member) => {
    if (!member.users) return "??"
    const name = member.users.full_name || member.users.username || member.users.email
    if (!name) return "??"
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Members - {padName}</DialogTitle>
          <DialogDescription>Add members and manage their permissions for this social pad</DialogDescription>
        </DialogHeader>

        {feedbackMessage && (
          <div
            className={`p-3 rounded-lg ${
              feedbackMessage.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {feedbackMessage.text}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite">Invite Members</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="space-y-4">
            {isOwner && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Member by Email
                </h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    type="email"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleInviteMember()
                      }
                    }}
                  />
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as "admin" | "editor" | "viewer")}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInviteMember} disabled={!inviteEmail.trim() || inviting}>
                    {inviting ? "Inviting..." : "Invite"}
                  </Button>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>Admin:</strong> Same permissions as Owner - can do everything
                  </p>
                  <p>
                    <strong>Editor:</strong> Can edit and reply to sticks
                  </p>
                  <p>
                    <strong>Viewer:</strong> Can only reply to sticks (read-only for pad/stick content)
                  </p>
                  <p className="text-xs text-purple-600 mt-2">
                    💡 If the user doesn&apos;t have an account, they&apos;ll receive an email invitation to sign up.
                  </p>
                </div>
              </div>
            )}

            {isOwner && pendingInvites.length > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Pending Invitations ({pendingInvites.length})
                </h3>
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-yellow-600" />
                        <div>
                          <p className="font-medium">{invite.email}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Invited {new Date(invite.invited_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{invite.role}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleCancelInvite(invite.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Members ({members.length})
              </h3>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No members yet</div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {member.users?.avatar_url && (
                            <AvatarImage
                              src={member.users.avatar_url || "/placeholder.svg"}
                              alt={getDisplayName(member)}
                            />
                          )}
                          <AvatarFallback>{getInitials(member)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{getDisplayName(member)}</p>
                          <p className="text-sm text-gray-500">{member.users?.email || "No email"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner && (
                          <div className="flex items-center gap-1 mr-2">
                            <span className="text-sm text-gray-500">$</span>
                            <Input
                              type="number"
                              className="w-20 h-8"
                              placeholder="Rate/hr"
                              defaultValue={
                                member.users?.hourly_rate_cents ? (member.users.hourly_rate_cents / 100).toFixed(2) : ""
                              }
                              onBlur={(e) => handleUpdateRate(member.id, e.target.value)}
                              title="Hourly Rate"
                            />
                          </div>
                        )}

                        {isOwner && member.role !== "owner" ? (
                          <Select value={member.role} onValueChange={(value) => handleUpdateRole(member.id, value)}>
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
                        )}
                        {isOwner && member.role !== "owner" && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            {isOwner ? (
              <>
                <div className="space-y-2">
                  <Label>Select Role for Bulk Invites</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as "admin" | "editor" | "viewer")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <CsvEmailUpload onEmailsUploaded={handleCsvUpload} />

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Add Multiple Emails
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="bulk-emails">Email Addresses</Label>
                      <textarea
                        id="bulk-emails"
                        value={bulkEmails}
                        onChange={(e) => setBulkEmails(e.target.value)}
                        placeholder="Enter emails separated by commas, semicolons, or new lines&#10;example@email.com, another@email.com&#10;third@email.com"
                        className="w-full min-h-[120px] p-2 border border-gray-300 rounded-md resize-vertical"
                        rows={5}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Separate emails with commas, semicolons, or new lines
                      </p>
                    </div>
                    <Button onClick={handleBulkInvite} disabled={!bulkEmails.trim() || inviting}>
                      {inviting ? "Inviting..." : "Invite All"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">Only the pad owner can invite members</div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
