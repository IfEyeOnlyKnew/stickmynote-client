"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import type { Organization, OrganizationMember, OrgRole } from "@/types/organization"
import { useUser } from "@/contexts/user-context"

// Types
interface OrganizationContextType {
  currentOrg: Organization | null
  currentOrgRole: OrgRole | null
  organizations: Organization[]
  memberships: OrganizationMember[]
  loading: boolean
  error: string | null
  switchOrganization: (orgId: string) => Promise<void>
  refreshOrganizations: () => Promise<void>
  createOrganization: (name: string, type?: "team" | "enterprise") => Promise<Organization | null>
  isPersonalOrg: boolean
  canManage: boolean
  canInvite: boolean
  canCreate: boolean
}

interface RawMembership {
  id: string
  org_id: string
  user_id: string
  role: string
  invited_by: string | null
  invited_at: string | null
  joined_at: string
  organizations: Organization | Organization[] | null
}

interface NormalizedMembership {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  invited_by: string | null
  invited_at: string | null
  joined_at: string
  organizations: Organization | null
}

// Constants
const ORG_STORAGE_KEY = "stick_my_note_current_org"
const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// Helper functions
function normalizeOrganization(org: Organization | Organization[] | null): Organization | null {
  if (!org) return null
  return Array.isArray(org) ? org[0] : org
}

function normalizeMembership(raw: RawMembership): NormalizedMembership {
  return {
    id: String(raw.id),
    org_id: String(raw.org_id),
    user_id: String(raw.user_id),
    role: raw.role as OrgRole,
    invited_by: raw.invited_by ? String(raw.invited_by) : null,
    invited_at: raw.invited_at ? String(raw.invited_at) : null,
    joined_at: String(raw.joined_at),
    organizations: normalizeOrganization(raw.organizations),
  }
}

function toOrganizationMember(m: NormalizedMembership): OrganizationMember {
  return {
    id: m.id,
    org_id: m.org_id,
    user_id: m.user_id,
    role: m.role,
    invited_by: m.invited_by ?? undefined,
    invited_at: m.invited_at ?? undefined,
    joined_at: m.joined_at,
    organization: m.organizations ?? undefined,
  }
}

function getStoredOrgId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ORG_STORAGE_KEY)
}

function persistOrgSelection(orgId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ORG_STORAGE_KEY, orgId)
  document.cookie = `current_org_id=${orgId}; path=/; max-age=${ORG_COOKIE_MAX_AGE}; SameSite=Lax`
}

function dispatchOrgChangedEvent(orgId: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("organizationChanged", { detail: { orgId } }))
}

function selectDefaultOrganization(
  memberships: NormalizedMembership[],
  organizations: Organization[],
  storedOrgId: string | null
): { org: Organization | null; role: OrgRole | null } {
  // Try stored org first
  if (storedOrgId) {
    const membership = memberships.find((m) => m.org_id === storedOrgId)
    if (membership?.organizations) {
      return { org: membership.organizations, role: membership.role }
    }
  }

  // No orgs available
  if (organizations.length === 0) {
    return { org: null, role: null }
  }

  // Prefer personal org
  const personalOrg = organizations.find((o) => o.type === "personal")
  if (personalOrg) {
    const membership = memberships.find((m) => m.org_id === personalOrg.id)
    return { org: personalOrg, role: membership?.role ?? "owner" }
  }

  // Fall back to first org
  const firstMembership = memberships[0]
  if (firstMembership?.organizations) {
    return { org: firstMembership.organizations, role: firstMembership.role }
  }

  return { org: null, role: null }
}

// Context
const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

// Provider
export function OrganizationProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = useUser()

  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [currentOrgRole, setCurrentOrgRole] = useState<OrgRole | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lastFetchedUserId = useRef<string | null>(null)
  const isFetching = useRef(false)

  const clearState = useCallback(() => {
    setOrganizations([])
    setMemberships([])
    setCurrentOrg(null)
    setCurrentOrgRole(null)
    setLoading(false)
    lastFetchedUserId.current = null
  }, [])

  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      clearState()
      return
    }

    // Prevent duplicate fetches
    if (lastFetchedUserId.current === user.id || isFetching.current) {
      setLoading(false)
      return
    }

    try {
      isFetching.current = true
      setLoading(true)
      setError(null)

      const response = await fetch("/api/v2/user/memberships", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        if (response.status === 401) {
          clearState()
          isFetching.current = false
          return
        }
        throw new Error("Failed to fetch memberships")
      }

      const { memberships: membershipData } = await response.json()
      lastFetchedUserId.current = user.id

      // Normalize memberships
      const normalizedMemberships = ((membershipData || []) as RawMembership[]).map(normalizeMembership)

      // Extract organizations
      const fetchedOrgs = normalizedMemberships
        .map((m) => m.organizations)
        .filter((org): org is Organization => org !== null)

      setMemberships(normalizedMemberships.map(toOrganizationMember))
      setOrganizations(fetchedOrgs)

      // Select current organization
      const storedOrgId = getStoredOrgId()
      const { org: selectedOrg, role: selectedRole } = selectDefaultOrganization(
        normalizedMemberships,
        fetchedOrgs,
        storedOrgId
      )

      setCurrentOrg(selectedOrg)
      setCurrentOrgRole(selectedRole)

      if (selectedOrg) {
        persistOrgSelection(selectedOrg.id)
      }
    } catch (err) {
      console.error("[OrganizationContext] Error fetching organizations:", err)
      setError("Failed to load organizations")
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [user, clearState])

  const switchOrganization = useCallback(
    async (orgId: string) => {
      const membership = memberships.find((m) => m.org_id === orgId)
      if (!membership) {
        setError("You do not have access to this organization")
        return
      }

      const org = organizations.find((o) => o.id === orgId)
      if (!org) {
        setError("Organization not found")
        return
      }

      setCurrentOrg(org)
      setCurrentOrgRole(membership.role)
      persistOrgSelection(orgId)
      dispatchOrgChangedEvent(orgId)
    },
    [memberships, organizations]
  )

  const createOrganization = useCallback(
    async (name: string, type: "team" | "enterprise" = "team"): Promise<Organization | null> => {
      if (!user) {
        setError("Must be logged in to create an organization")
        return null
      }

      try {
        const response = await fetch("/api/v2/organizations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || "Failed to create organization")
          return null
        }

        const { organization: newOrg } = await response.json()

        // Reset fetch state and refresh
        lastFetchedUserId.current = null
        isFetching.current = false
        await fetchOrganizations()

        return newOrg as Organization
      } catch (err) {
        console.error("[OrganizationContext] Error creating organization:", err)
        setError("Failed to create organization")
        return null
      }
    },
    [user, fetchOrganizations]
  )

  const refreshOrganizations = useCallback(async () => {
    lastFetchedUserId.current = null
    isFetching.current = false
    await fetchOrganizations()
  }, [fetchOrganizations])

  // Initialize on user change
  useEffect(() => {
    if (user?.id !== lastFetchedUserId.current) {
      fetchOrganizations()
    }
  }, [user?.id, fetchOrganizations])

  // Computed values
  const isPersonalOrg = currentOrg?.type === "personal"
  const canManage = currentOrgRole === "owner" || currentOrgRole === "admin"
  const canInvite = currentOrgRole === "owner" || currentOrgRole === "admin"
  const canCreate = currentOrgRole !== "viewer"

  const value: OrganizationContextType = {
    currentOrg,
    currentOrgRole,
    organizations,
    memberships,
    loading,
    error,
    switchOrganization,
    refreshOrganizations,
    createOrganization,
    isPersonalOrg,
    canManage,
    canInvite,
    canCreate,
  }

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

// Hook
export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider")
  }
  return context
}

export default OrganizationProvider
