"use client"

import { useState, useEffect, useCallback } from "react"
import { useOrganization } from "@/contexts/organization-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, UserPlus, Trash2, Crown, Shield, User, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Member {
  id: string
  user_id: string
  role: string
  accepted_at: string | null
  users: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
}

interface ManageMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageMembersDialog({ open, onOpenChange }: Readonly<ManageMembersDialogProps>) {
  const { currentOrg, currentOrgRole, canInvite, isPersonalOrg } = useOrganization()
  const { toast } = useToast()

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member")
  const [inviting, setInviting] = useState(false)

  const fetchMembers = useCallback(async () => {
    if (!currentOrg) return

    try {
      setLoading(true)
      const res = await fetch(`/api/organizations/${currentOrg.id}/members`)

      if (!res.ok) {
        throw new Error("Failed to fetch members")
      }

      const data = await res.json()
      setMembers(data.members || [])
    } catch (err) {
      console.error("Error fetching members:", err)
      toast({
        title: "Error",
        description: "Failed to load members",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [currentOrg, toast])

  useEffect(() => {
    if (open && currentOrg) {
      fetchMembers()
    }
  }, [open, currentOrg, fetchMembers])

  const handleInvite = async () => {
    if (!currentOrg || !inviteEmail.trim()) return

    setInviting(true)
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to invite member")
      }

      toast({
        title: "Member added",
        description: `Invitation sent to ${inviteEmail}`,
      })

      setInviteEmail("")
      fetchMembers()
    } catch (err) {
      console.error("Error inviting member:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to invite member",
        variant: "destructive",
      })
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!currentOrg) return

    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/members?userId=${userId}`, { method: "DELETE" })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to remove member")
      }

      toast({
        title: "Member removed",
        description: "The member has been removed from the organization",
      })

      fetchMembers()
    } catch (err) {
      console.error("Error removing member:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove member",
        variant: "destructive",
      })
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-3 w-3" />
      case "admin":
        return <Shield className="h-3 w-3" />
      case "viewer":
        return <Eye className="h-3 w-3" />
      default:
        return <User className="h-3 w-3" />
    }
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

  const canRemoveMember = (member: Member) => {
    if (member.role === "owner") return false
    if (currentOrgRole === "owner") return true
    if (currentOrgRole === "admin" && ["member", "viewer"].includes(member.role)) return true
    return false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            {isPersonalOrg
              ? "This is your personal workspace. You cannot add members to a personal organization."
              : `Add or remove members from ${currentOrg?.name}`}
          </DialogDescription>
        </DialogHeader>

        {!isPersonalOrg && canInvite && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 grid gap-2">
              <Label htmlFor="invite-email">Invite by email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)} disabled={inviting}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentOrgRole === "owner" && <SelectItem value="admin">Admin</SelectItem>}
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>
        )}

        <ScrollArea className="h-[300px] pr-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {!loading && members.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">No members found</div>
          )}
          {!loading && members.length > 0 && (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.users?.avatar_url || undefined} />
                      <AvatarFallback>
                        {(member.users?.full_name || member.users?.email || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.users?.full_name || member.users?.email}</p>
                      {member.users?.full_name && (
                        <p className="text-xs text-muted-foreground">{member.users?.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(member.role) as any}>
                      <span className="flex items-center gap-1">
                        {getRoleIcon(member.role)}
                        {member.role}
                      </span>
                    </Badge>
                    {canRemoveMember(member) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(member.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
