"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"
import type { MemberPermissions } from "@/types/permissions"

interface RoleTemplate {
  name: string
  description: string
  color: string
  permissions: MemberPermissions
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: "Viewer",
    description: "Can only view and reply to sticks",
    color: "bg-gray-500",
    permissions: {
      can_create_sticks: false,
      can_reply: true,
      can_edit_others_sticks: false,
      can_delete_others_sticks: false,
      can_invite_members: false,
      can_pin_sticks: false,
    },
  },
  {
    name: "Contributor",
    description: "Can create sticks and reply",
    color: "bg-blue-500",
    permissions: {
      can_create_sticks: true,
      can_reply: true,
      can_edit_others_sticks: false,
      can_delete_others_sticks: false,
      can_invite_members: false,
      can_pin_sticks: false,
    },
  },
  {
    name: "Editor",
    description: "Can create, edit, and reply to all sticks",
    color: "bg-purple-500",
    permissions: {
      can_create_sticks: true,
      can_reply: true,
      can_edit_others_sticks: true,
      can_delete_others_sticks: false,
      can_invite_members: false,
      can_pin_sticks: false,
    },
  },
  {
    name: "Moderator",
    description: "Can manage content and pin sticks",
    color: "bg-orange-500",
    permissions: {
      can_create_sticks: true,
      can_reply: true,
      can_edit_others_sticks: true,
      can_delete_others_sticks: true,
      can_invite_members: false,
      can_pin_sticks: true,
    },
  },
  {
    name: "Admin",
    description: "Full access to all features",
    color: "bg-red-500",
    permissions: {
      can_create_sticks: true,
      can_reply: true,
      can_edit_others_sticks: true,
      can_delete_others_sticks: true,
      can_invite_members: true,
      can_pin_sticks: true,
    },
  },
]

interface PermissionRoleTemplatesProps {
  onSelectTemplate: (permissions: MemberPermissions) => void
  currentPermissions?: MemberPermissions
}

export function PermissionRoleTemplates({ onSelectTemplate, currentPermissions }: PermissionRoleTemplatesProps) {
  const isTemplateActive = (template: RoleTemplate) => {
    if (!currentPermissions) return false
    return Object.keys(template.permissions).every(
      (key) =>
        template.permissions[key as keyof MemberPermissions] === currentPermissions[key as keyof MemberPermissions],
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium mb-1">Quick Role Templates</h3>
        <p className="text-xs text-muted-foreground">Apply a predefined role or customize permissions below</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ROLE_TEMPLATES.map((template) => {
          const isActive = isTemplateActive(template)
          return (
            <Card
              key={template.name}
              className={`cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-primary" : ""}`}
              onClick={() => onSelectTemplate(template.permissions)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {template.name}
                      {isActive && <Check className="h-4 w-4 text-primary" />}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
                  </div>
                  <Badge className={`${template.color} text-white`}>{template.name}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {Object.entries(template.permissions).map(([key, value]) => (
                    <div key={key} className="flex items-center text-xs">
                      <div className={`h-2 w-2 rounded-full mr-2 ${value ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className={value ? "text-foreground" : "text-muted-foreground"}>
                        {key.replace("can_", "").replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
