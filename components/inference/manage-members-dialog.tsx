"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import { UserPlus, Trash2, Shield, FileText, Mail, Clock, Search, Users, Loader2, Building2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CsvEmailUpload } from "@/components/csv-email-upload"
import { ScrollArea } from "@/components/ui/scroll-area"

// LDAP search result type
interface LDAPUser {
  id: string | null
  username: string | null
  email: string | null
  full_name: string | null
  source: "ldap" | "database"
  dn?: string
}

// AD Group type
interface ADGroup {
  dn: string
  name: string
  description: string
  memberCount: number
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

type InviteRole = "admin" | "editor" | "viewer"

export function ManageMembersDialog({ open, onOpenChange, padId, padName }: Readonly<ManageMembersDialogProps>) {
  const [members, setMembers] = useState<Member[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<InviteRole>("viewer")
  const [inviting, setInviting] = useState(false)
  const [activeTab, setActiveTab] = useState("invite")
  const [bulkEmails, setBulkEmails] = useState("")
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // LDAP Search state
  const [ldapSearchResults, setLdapSearchResults] = useState<LDAPUser[]>([])
  const [ldapSearching, setLdapSearching] = useState(false)
  const [showLdapDropdown, setShowLdapDropdown] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // AD Group Search state
  const [groupSearchQuery, setGroupSearchQuery] = useState("")
  const [adGroups, setAdGroups] = useState<ADGroup[]>([])
  const [groupSearching, setGroupSearching] = useState(false)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [invitingGroup, setInvitingGroup] = useState(false)
  const groupSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const groupSearchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && padId) {
      fetchMembers()
      fetchPendingInvites()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, padId])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowLdapDropdown(false)
      }
      if (groupSearchContainerRef.current && !groupSearchContainerRef.current.contains(event.target as Node)) {
        setShowGroupDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // LDAP User Search
  const searchLdapUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setLdapSearchResults([])
      setShowLdapDropdown(false)
      return
    }

    setLdapSearching(true)
    try {
      const response = await fetch(`/api/user-search?query=${encodeURIComponent(query)}&limit=10&source=both`)
      if (response.ok) {
        const results = await response.json()
        setLdapSearchResults(results)
        setShowLdapDropdown(results.length > 0)
      }
    } catch (error) {
      console.error("LDAP search error:", error)
    } finally {
      setLdapSearching(false)
    }
  }, [])

  // Debounced search handler
  const handleEmailInputChange = useCallback((value: string) => {
    setInviteEmail(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLdapUsers(value)
    }, 300)
  }, [searchLdapUsers])

  // Select user from LDAP search
  const handleSelectLdapUser = useCallback((user: LDAPUser) => {
    if (user.email) {
      setInviteEmail(user.email)
    }
    setShowLdapDropdown(false)
    setLdapSearchResults([])
  }, [])

  // AD Group Search
  const searchAdGroups = useCallback(async (query: string) => {
    if (query.length < 2) {
      setAdGroups([])
      setShowGroupDropdown(false)
      return
    }

    setGroupSearching(true)
    try {
      const response = await fetch(`/api/ad-groups/search?query=${encodeURIComponent(query)}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setAdGroups(data.groups || [])
        setShowGroupDropdown(data.groups?.length > 0)
      }
    } catch (error) {
      console.error("AD group search error:", error)
    } finally {
      setGroupSearching(false)
    }
  }, [])

  // Debounced group search
  const handleGroupSearchChange = useCallback((value: string) => {
    setGroupSearchQuery(value)

    if (groupSearchTimeoutRef.current) {
      clearTimeout(groupSearchTimeoutRef.current)
    }

    groupSearchTimeoutRef.current = setTimeout(() => {
      searchAdGroups(value)
    }, 300)
  }, [searchAdGroups])

  // Invite all members of an AD group
  const handleInviteGroup = useCallback(async (group: ADGroup) => {
    setInvitingGroup(true)
    setShowGroupDropdown(false)
    setFeedbackMessage(null)

    try {
      const response = await fetch(`/api/inference-pads/${padId}/members/ad-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupDn: group.dn,
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setGroupSearchQuery("")
        setFeedbackMessage({
          type: "success",
          text: data.message || `Successfully invited ${data.added || 0} members from group "${group.name}"`,
        })
        fetchMembers()
        fetchPendingInvites()
      } else {
        setFeedbackMessage({ type: "error", text: data.error || "Failed to invite group members" })
      }
    } catch (error) {
      console.error("Error inviting group:", error)
      setFeedbackMessage({ type: "error", text: "Failed to invite group members" })
    } finally {
      setInvitingGroup(false)
    }
  }, [padId, inviteRole])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/inference-pads/${padId}/members`)
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
      const response = await fetch(`/api/inference-pads/${padId}/pending-invites`)
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
      const response = await fetch(`/api/inference-pads/${padId}/members`, {
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

  const handleUpdateRate = async (memberId: string, rate: string) => {
    const rateCents = Math.round(Number.parseFloat(rate) * 100)
    if (Number.isNaN(rateCents)) return

    try {
      const response = await fetch(`/api/inference-pads/${padId}/members`, {
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
      setFeedbackMessage(null)
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
      const response = await fetch(`/api/inference-pads/${padId}/pending-invites?inviteId=${inviteId}`, {
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
          <DialogDescription>Add members and manage their permissions for this inference pad</DialogDescription>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invite">Invite Members</TabsTrigger>
            <TabsTrigger value="groups">AD Groups</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="space-y-4">
            {isOwner && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Member by Email
                  <Badge variant="outline" className="text-xs">LDAP Search</Badge>
                </h3>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={searchContainerRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by name or enter email..."
                        value={inviteEmail}
                        onChange={(e) => handleEmailInputChange(e.target.value)}
                        onFocus={() => ldapSearchResults.length > 0 && setShowLdapDropdown(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setShowLdapDropdown(false)
                            handleInviteMember()
                          }
                        }}
                        className="pl-9"
                      />
                      {ldapSearching && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </div>

                    {/* LDAP Search Results Dropdown */}
                    {showLdapDropdown && ldapSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-hidden">
                        <ScrollArea className="max-h-64">
                          {ldapSearchResults.map((user, idx) => (
                            <button
                              key={user.email || idx}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-3 border-b last:border-b-0"
                              onClick={() => handleSelectLdapUser(user)}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {(user.full_name || user.username || user.email || "??").substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {user.full_name || user.username || "Unknown"}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {user.source === "ldap" ? "AD" : "DB"}
                              </Badge>
                            </button>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as InviteRole)}
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
                    💡 Start typing a name to search Active Directory, or enter an email directly.
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
              {loading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                </div>
              )}
              {!loading && members.length === 0 && (
                <div className="text-center py-8 text-gray-500">No members yet</div>
              )}
              {!loading && members.length > 0 && (
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

          <TabsContent value="groups" className="space-y-4">
            {isOwner ? (
              <div className="space-y-4">
                <div className="space-y-4 border-b pb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Invite AD Group Members
                    <Badge variant="outline" className="text-xs">Active Directory</Badge>
                  </h3>

                  <div className="space-y-2">
                    <Label>Select Role for Group Members</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as InviteRole)}
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

                  <div className="relative" ref={groupSearchContainerRef}>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search AD groups by name..."
                        value={groupSearchQuery}
                        onChange={(e) => handleGroupSearchChange(e.target.value)}
                        onFocus={() => adGroups.length > 0 && setShowGroupDropdown(true)}
                        className="pl-9"
                        disabled={invitingGroup}
                      />
                      {(groupSearching || invitingGroup) && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </div>

                    {/* AD Group Search Results Dropdown */}
                    {showGroupDropdown && adGroups.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-hidden">
                        <ScrollArea className="max-h-64">
                          {adGroups.map((group) => (
                            <button
                              key={group.dn}
                              type="button"
                              className="w-full px-3 py-3 text-left hover:bg-gray-100 border-b last:border-b-0"
                              onClick={() => handleInviteGroup(group)}
                              disabled={invitingGroup}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">{group.name}</p>
                                  {group.description && (
                                    <p className="text-xs text-gray-500 truncate">{group.description}</p>
                                  )}
                                </div>
                                <Badge variant="secondary" className="shrink-0">
                                  {group.memberCount} members
                                </Badge>
                              </div>
                            </button>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Search for an Active Directory group to invite all its members at once.</p>
                    <p className="text-xs text-purple-600 mt-2">
                      💡 All group members will be invited with the selected role. Existing members will be skipped.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">Only the pad owner can invite members</div>
            )}
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            {isOwner ? (
              <>
                <div className="space-y-2">
                  <Label>Select Role for Bulk Invites</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as InviteRole)}
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
