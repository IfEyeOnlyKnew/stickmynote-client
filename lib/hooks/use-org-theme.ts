"use client"

import { useEffect } from "react"
import type { Organization } from "@/types/organization"

/**
 * Hook to apply organization branding theme to the document
 * Updates CSS variables based on org settings
 */
export function useOrgTheme(org: Organization | null) {
  useEffect(() => {
    if (!org?.settings?.branding) {
      // Reset to defaults if no branding
      document.documentElement.style.setProperty("--brand-primary", "#4F46E5")
      document.documentElement.style.setProperty("--brand-secondary", "#7C3AED")
      document.documentElement.style.setProperty("--brand-accent", "#06B6D4")
      return
    }

    const branding = org.settings.branding

    // Apply primary color
    if (branding.primary_color) {
      document.documentElement.style.setProperty("--brand-primary", branding.primary_color)
    }

    // Apply secondary color
    if (branding.secondary_color) {
      document.documentElement.style.setProperty("--brand-secondary", branding.secondary_color)
    }

    // Apply accent color
    if (branding.accent_color) {
      document.documentElement.style.setProperty("--brand-accent", branding.accent_color)
    }

    // Update favicon if provided
    if (branding.favicon_url) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement
      if (!link) {
        link = document.createElement("link")
        link.rel = "icon"
        document.head.appendChild(link)
      }
      link.href = branding.favicon_url
    }

    // Update document title if custom display name provided
    if (branding.organization_display_name) {
      const currentTitle = document.title
      const titleParts = currentTitle.split("|")
      if (titleParts.length > 1) {
        // Keep the page-specific part, update org name
        document.title = `${titleParts[0].trim()} | ${branding.organization_display_name}`
      } else {
        document.title = branding.organization_display_name
      }
    }
  }, [org])
}

/**
 * Get the display name for an organization
 */
export function getOrgDisplayName(org: Organization | null): string {
  if (!org) return ""
  return org.settings?.branding?.organization_display_name || org.name
}

/**
 * Get the logo URL for an organization
 * @param preferDark - Whether to prefer dark mode logo
 */
export function getOrgLogo(org: Organization | null, preferDark = false): string | null {
  if (!org?.settings?.branding) return null

  if (preferDark && org.settings.branding.logo_dark_url) {
    return org.settings.branding.logo_dark_url
  }

  return org.settings.branding.logo_url || null
}

/**
 * Get brand colors for an organization
 */
export function getOrgBrandColors(org: Organization | null) {
  const defaults = {
    primary: "#4F46E5",
    secondary: "#7C3AED",
    accent: "#06B6D4",
  }

  if (!org?.settings?.branding) return defaults

  return {
    primary: org.settings.branding.primary_color || defaults.primary,
    secondary: org.settings.branding.secondary_color || defaults.secondary,
    accent: org.settings.branding.accent_color || defaults.accent,
  }
}
