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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Trash2, Shield, Crown } from 'lucide-react'
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
  onPadUpdated?: () => void
}

export function PadSettingsDialog({ open, onOpenChange, padId, padName, userRole, onPadUpdated }: Readonly<PadSettingsDialogProps>) {
  const [members, setMembers] = useState<PadMember[]>([])
  const [loading, setLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [nameInput, setNameInput] = useState(padName)
  const [savingName, setSavingName] = useState(false)

  const canManageMembers = ["admin", "owner"].includes(userRole || "")
  const canEditPad = canManageMembers
  const nameChanged = nameInput.trim() !== padName.trim()

  useEffect(() => {
    if (open) setNameInput(padName)
  }, [open, padName])

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open && padId) {
      fetchMembers()
    }
  }, [open, padId])
  /* eslint-enable react-hooks/exhaustive-deps */

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

  const handleSaveName = async () => {
    if (!canEditPad) return
    const trimmed = nameInput.trim()
    if (!trimmed) {
      setFeedbackMessage({ type: "error", text: "Pad name cannot be empty" })
      return
    }
    if (trimmed === padName.trim()) return

    setSavingName(true)
    try {
      const response = await fetch(`/api/pads/${padId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      if (response.ok) {
        setFeedbackMessage({ type: "success", text: "Pad name updated" })
        onPadUpdated?.()
      } else {
        const data = await response.json().catch(() => ({}))
        setFeedbackMessage({ type: "error", text: data.error || "Failed to update pad name" })
      }
    } catch (error) {
      console.error("Error updating pad name:", error)
      setFeedbackMessage({ type: "error", text: "Failed to update pad name" })
    } finally {
      setSavingName(false)
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

        <div className="space-y-2 pb-4 border-b">
          <Label htmlFor="pad-name-input" className="text-sm font-medium">
            Pad Name
          </Label>
          <div className="flex gap-2">
            <Input
              id="pad-name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={200}
              disabled={!canEditPad || savingName}
              placeholder="Pad name"
            />
            {canEditPad && (
              <Button onClick={handleSaveName} disabled={!nameChanged || savingName || !nameInput.trim()}>
                {savingName && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save
              </Button>
            )}
          </div>
          {!canEditPad && (
            <p className="text-xs text-muted-foreground">Only pad admins and owners can rename this pad.</p>
          )}
        </div>

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
