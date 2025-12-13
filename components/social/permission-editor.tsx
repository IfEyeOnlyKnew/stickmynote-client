"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { PadMember, MemberPermissions } from "@/types/permissions"
import { Save, FileText, MessageSquare, Edit, Trash2, UserPlus, Pin } from "lucide-react"

interface PermissionEditorProps {
  member: PadMember
  padId: string
  onUpdate: () => void
}

const PERMISSION_CONFIGS = [
  {
    key: "can_create_sticks" as keyof MemberPermissions,
    label: "Create Sticks",
    description: "Can create new sticks in the pad",
    icon: FileText,
  },
  {
    key: "can_reply" as keyof MemberPermissions,
    label: "Add Replies",
    description: "Can reply to sticks",
    icon: MessageSquare,
  },
  {
    key: "can_edit_others_sticks" as keyof MemberPermissions,
    label: "Edit Others' Sticks",
    description: "Can edit sticks created by other members",
    icon: Edit,
  },
  {
    key: "can_delete_others_sticks" as keyof MemberPermissions,
    label: "Delete Others' Sticks",
    description: "Can delete sticks created by other members",
    icon: Trash2,
  },
  {
    key: "can_invite_members" as keyof MemberPermissions,
    label: "Invite Members",
    description: "Can invite new members to the pad",
    icon: UserPlus,
  },
  {
    key: "can_pin_sticks" as keyof MemberPermissions,
    label: "Pin Sticks",
    description: "Can pin/unpin sticks to the top",
    icon: Pin,
  },
]

export function PermissionEditor({ member, padId, onUpdate }: PermissionEditorProps) {
  const [permissions, setPermissions] = useState<MemberPermissions>({
    can_create_sticks: member.can_create_sticks,
    can_reply: member.can_reply,
    can_edit_others_sticks: member.can_edit_others_sticks,
    can_delete_others_sticks: member.can_delete_others_sticks,
    can_invite_members: member.can_invite_members,
    can_pin_sticks: member.can_pin_sticks,
  })
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleToggle = (key: keyof MemberPermissions) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/social-pads/${padId}/members/${member.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions),
      })

      if (response.ok) {
        setHasChanges(false)
        onUpdate()
      } else {
        alert("Failed to update permissions")
      }
    } catch (error) {
      console.error("Error saving permissions:", error)
      alert("An error occurred while saving permissions")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPermissions({
      can_create_sticks: member.can_create_sticks,
      can_reply: member.can_reply,
      can_edit_others_sticks: member.can_edit_others_sticks,
      can_delete_others_sticks: member.can_delete_others_sticks,
      can_invite_members: member.can_invite_members,
      can_pin_sticks: member.can_pin_sticks,
    })
    setHasChanges(false)
  }

  const memberName = member.users?.full_name || member.users?.username || member.users?.email || "Member"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Permissions for {memberName}</CardTitle>
            <CardDescription>Customize what this member can do in the pad</CardDescription>
          </div>
          <Badge variant={member.admin_level === "admin" ? "default" : "secondary"}>{member.role}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {PERMISSION_CONFIGS.map((config) => {
            const Icon = config.icon
            return (
              <div key={config.key} className="flex items-center justify-between space-x-4">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-0.5">
                    <Label htmlFor={config.key} className="text-base font-medium">
                      {config.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                <Switch
                  id={config.key}
                  checked={permissions[config.key]}
                  onCheckedChange={() => handleToggle(config.key)}
                />
              </div>
            )
          })}
        </div>

        {hasChanges && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
