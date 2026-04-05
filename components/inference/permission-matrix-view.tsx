"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X } from "lucide-react"
import type { PadMember } from "@/types/permissions"

interface PermissionMatrixViewProps {
  members: PadMember[]
  onEditMember: (member: PadMember) => void
}

const PERMISSION_LABELS = {
  can_create_sticks: "Create",
  can_reply: "Reply",
  can_edit_others_sticks: "Edit Others",
  can_delete_others_sticks: "Delete Others",
  can_invite_members: "Invite",
  can_pin_sticks: "Pin",
}

export function PermissionMatrixView({ members, onEditMember }: Readonly<PermissionMatrixViewProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission Matrix</CardTitle>
        <CardDescription>Overview of all member permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Member</th>
                <th className="text-left p-2 font-medium">Role</th>
                {Object.values(PERMISSION_LABELS).map((label) => (
                  <th key={label} className="text-center p-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onEditMember(member)}
                >
                  <td className="p-2">
                    <div>
                      <p className="font-medium">{member.users?.full_name || member.users?.username || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{member.users?.email}</p>
                    </div>
                  </td>
                  <td className="p-2">
                    <Badge variant={member.admin_level === "admin" ? "default" : "secondary"}>{member.role}</Badge>
                  </td>
                  {Object.keys(PERMISSION_LABELS).map((key) => {
                    const hasPermission = member[key as keyof typeof PERMISSION_LABELS]
                    return (
                      <td key={key} className="text-center p-2">
                        {hasPermission ? (
                          <Check className="h-4 w-4 text-green-500 inline-block" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300 inline-block" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
