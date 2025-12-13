"use client"

import type React from "react"
import { useOrganization } from "@/contexts/organization-context"
import { useOrgTheme } from "@/lib/hooks/use-org-theme"

/**
 * Component that applies organization branding theme to the application
 * Should be mounted once in the layout
 */
export function OrgThemeProvider({ children }: { children: React.ReactNode }) {
  const { currentOrg } = useOrganization()

  // Apply theme whenever org changes
  useOrgTheme(currentOrg)

  return <>{children}</>
}
