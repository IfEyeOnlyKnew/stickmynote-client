"use client"

import { useState } from "react"
import { useOrganization } from "@/contexts/organization-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Check, ChevronDown, Plus, Building2, User, Users } from "lucide-react"
import { CreateOrgDialog } from "./create-org-dialog"

export function OrgSwitcher() {
  const { currentOrg, organizations, loading, switchOrganization } = useOrganization()

  const [showCreateDialog, setShowCreateDialog] = useState(false)

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="w-[180px] bg-transparent">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </Button>
    )
  }

  if (!currentOrg) {
    return null
  }

  const getOrgIcon = (type: string) => {
    switch (type) {
      case "personal":
        return <User className="h-4 w-4" />
      case "team":
        return <Users className="h-4 w-4" />
      case "enterprise":
        return <Building2 className="h-4 w-4" />
      default:
        return <Building2 className="h-4 w-4" />
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-[200px] justify-between bg-transparent">
            <div className="flex items-center gap-2 truncate">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs bg-primary/10">{getInitials(currentOrg.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{currentOrg.name}</span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Organization</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => switchOrganization(org.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                {getOrgIcon(org.type)}
                <span className="truncate">{org.name}</span>
              </div>
              {org.id === currentOrg.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrgDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </>
  )
}
