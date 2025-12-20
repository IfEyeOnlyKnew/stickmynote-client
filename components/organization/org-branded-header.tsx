"use client"

import { useOrganization } from "@/contexts/organization-context"
import { getOrgLogo, getOrgDisplayName } from "@/lib/hooks/use-org-theme"
import { StickyNote } from "lucide-react"

interface OrgBrandedHeaderProps {
  className?: string
  showLogo?: boolean
  showName?: boolean
}

/**
 * Header component that displays organization branding
 * Shows logo and/or display name based on org settings
 */
export function OrgBrandedHeader({ className = "", showLogo = true, showName = true }: OrgBrandedHeaderProps) {
  const { currentOrg } = useOrganization()

  const logoUrl = getOrgLogo(currentOrg, false)
  const displayName = getOrgDisplayName(currentOrg)

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLogo && (
        <>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl || "/placeholder.svg"} alt={displayName} className="h-8 w-auto object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <StickyNote className="h-5 w-5 text-white" />
            </div>
          )}
        </>
      )}
      {showName && displayName && <span className="text-xl font-bold text-gray-900">{displayName}</span>}
    </div>
  )
}
