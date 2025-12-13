"use client"

import { useOrganization } from "@/contexts/organization-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Building2 } from "lucide-react"

interface OrgDisplayProps {
  showLogo?: boolean
  className?: string
}

export function OrgDisplay({ showLogo = true, className = "" }: OrgDisplayProps) {
  const { currentOrg, loading } = useOrganization()

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-6 w-6 animate-pulse bg-muted rounded-full" />
        <div className="h-4 w-24 animate-pulse bg-muted rounded" />
      </div>
    )
  }

  if (!currentOrg) {
    return null
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const logoUrl = currentOrg.settings?.branding?.logo_url

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLogo && (
        <Avatar className="h-6 w-6">
          {logoUrl ? <AvatarImage src={logoUrl || "/placeholder.svg"} alt={currentOrg.name} /> : null}
          <AvatarFallback className="text-xs bg-primary/10">
            {logoUrl ? getInitials(currentOrg.name) : <Building2 className="h-3 w-3" />}
          </AvatarFallback>
        </Avatar>
      )}
      <span className="font-medium text-foreground">{currentOrg.name}</span>
    </div>
  )
}
