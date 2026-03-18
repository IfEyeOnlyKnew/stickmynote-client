"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, Loader2, AlertTriangle } from "lucide-react"
import { PermissionRoleTemplates } from "./permission-role-templates"
import type { MemberPermissions, PadMember } from "@/types/permissions"

interface BulkPermissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: PadMember[]
  padId: string
  onComplete: () => void
}

export function BulkPermissionsDialog({ open, onOpenChange, members, padId, onComplete }: BulkPermissionsDialogProps) {
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [permissions, setPermissions] = useState<MemberPermissions>({
    can_create_sticks: true,
    can_reply: true,
    can_edit_others_sticks: false,
    can_delete_others_sticks: false,
    can_invite_members: false,
    can_pin_sticks: false,
  })
  const [isApplying, setIsApplying] = useState(false)

  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers)
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId)
    } else {
      newSelected.add(memberId)
    }
    setSelectedMembers(newSelected)
  }

  const selectAll = () => {
    setSelectedMembers(new Set(members.map((m) => m.id)))
  }

  const deselectAll = () => {
    setSelectedMembers(new Set())
  }

  const applyPermissions = async () => {
    if (selectedMembers.size === 0) return

    setIsApplying(true)
    try {
      const promises = Array.from(selectedMembers).map((memberId) =>
        fetch(`/api/inference-pads/${padId}/members/${memberId}/permissions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(permissions),
        }),
      )

      await Promise.all(promises)
      onComplete()
      onOpenChange(false)
      setSelectedMembers(new Set())
    } catch (error) {
      console.error("[v0] Error applying bulk permissions:", error)
      alert("Failed to apply permissions to some members")
    } finally {
      setIsApplying(false)
    }
  }

  // Filter out owners and admins
  const editableMembers = members.filter((m) => m.admin_level !== "owner" && m.admin_level !== "admin")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Update Permissions
          </DialogTitle>
          <DialogDescription>Select members and apply permissions to multiple members at once</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {editableMembers.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No members available for bulk permission updates. Owners and admins cannot have their permissions
                changed.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-medium">
                    Select Members ({selectedMembers.size} of {editableMembers.length})
                  </Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      Deselect All
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-48 border rounded-md">
                  <div className="p-4 space-y-3">
                    {editableMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <Checkbox
                          id={member.id}
                          checked={selectedMembers.has(member.id)}
                          onCheckedChange={() => toggleMember(member.id)}
                        />
                        <Label htmlFor={member.id} className="flex-1 flex items-center justify-between cursor-pointer">
                          <div>
                            <p className="font-medium">
                              {member.users?.full_name || member.users?.username || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.users?.email}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{member.role}</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <PermissionRoleTemplates onSelectTemplate={setPermissions} currentPermissions={permissions} />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={applyPermissions} disabled={selectedMembers.size === 0 || isApplying}>
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              `Apply to ${selectedMembers.size} Member${selectedMembers.size !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
