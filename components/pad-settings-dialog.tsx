"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trash2, Shield, Crown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PadMember {
  id: string
  email: string
  username: string | null
  full_name: string | null
  role: string
}

interface PadSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  padId: string
  padName: string
  userRole: string | null
}

export function PadSettingsDialog({ open, onOpenChange, padId, padName, userRole }: PadSettingsDialogProps) {
  const [members, setMembers] = useState<PadMember[]>([])
  const [loading, setLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const canManageMembers = ["admin", "owner"].includes(userRole || "")

  useEffect(() => {
    if (open && padId) {
      fetchMembers()
    }
  }, [open, padId])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/pads/${padId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error("Error fetching members:", error)
      setFeedbackMessage({ type: "error", text: "Failed to load members" })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!canManageMembers) return

    try {
      const response = await fetch(`/api/pads/${padId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role: newRole,
        }),
      })

      if (response.ok) {
        setFeedbackMessage({ type: "success", text: "Role updated successfully" })
        fetchMembers()
      } else {
        const data = await response.json()
        setFeedbackMessage({ type: "error", text: data.error || "Failed to update role" })
      }
    } catch (error) {
      console.error("Error updating role:", error)
      setFeedbackMessage({ type: "error", text: "Failed to update role" })
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!canManageMembers) return
    if (!confirm("Are you sure you want to remove this member from the pad?")) return

    try {
      const response = await fetch(`/api/pads/${padId}/members?userId=${userId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setFeedbackMessage({ type: "success", text: "Member removed successfully" })
        fetchMembers()
      } else {
        const data = await response.json()
        setFeedbackMessage({ type: "error", text: data.error || "Failed to remove member" })
      }
    } catch (error) {
      console.error("Error removing member:", error)
      setFeedbackMessage({ type: "error", text: "Failed to remove member" })
    }
  }

  const getDisplayName = (member: PadMember) => {
    return member.full_name || member.username || member.email
  }

  const getInitials = (member: PadMember) => {
    const name = member.full_name || member.username || member.email
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin"
      case "edit":
      case "editor":
        return "Editor"
      case "view":
      case "viewer":
        return "Viewer"
      case "owner":
        return "Owner"
      default:
        return role
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Pad Settings - {padName}
          </DialogTitle>
          <DialogDescription>Manage members and their permissions for this pad</DialogDescription>
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

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Members ({members.length})
            </h3>
            {canManageMembers && (
              <div className="text-sm text-gray-600">
                <p className="font-medium">Role Permissions:</p>
                <p className="text-xs">
                  <strong>Admin:</strong> Full control, can invite others
                </p>
                <p className="text-xs">
                  <strong>Editor:</strong> Can create and edit sticks
                </p>
                <p className="text-xs">
                  <strong>Viewer:</strong> Can view and add replies
                </p>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No members yet</div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(member)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getDisplayName(member)}</p>
                      <p className="text-sm text-gray-500 truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageMembers && member.role !== "owner" ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleUpdateRole(member.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue>
                            {getRoleLabel(member.role)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="edit">Editor</SelectItem>
                          <SelectItem value="view">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1">
                        {member.role === "owner" && <Crown className="h-3 w-3" />}
                        {getRoleLabel(member.role)}
                      </Badge>
                    )}
                    {canManageMembers && member.role !== "owner" && (
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
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
