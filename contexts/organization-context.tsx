"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Organization, OrganizationMember, OrgRole } from "@/types/organization"
import { useUser } from "@/contexts/user-context"

interface OrganizationContextType {
  // Current organization
  currentOrg: Organization | null
  currentOrgRole: OrgRole | null

  // All user's organizations
  organizations: Organization[]
  memberships: OrganizationMember[]

  // Loading states
  loading: boolean
  error: string | null

  // Actions
  switchOrganization: (orgId: string) => Promise<void>
  refreshOrganizations: () => Promise<void>
  createOrganization: (name: string, type?: "team" | "enterprise") => Promise<Organization | null>

  // Helpers
  isPersonalOrg: boolean
  canManage: boolean
  canInvite: boolean
  canCreate: boolean
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

const ORG_STORAGE_KEY = "stick_my_note_current_org"

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()

  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [currentOrgRole, setCurrentOrgRole] = useState<OrgRole | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lastFetchedUserId = useRef<string | null>(null)
  const isFetching = useRef(false)

  // Fetch all organizations the user belongs to
  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([])
      setMemberships([])
      setCurrentOrg(null)
      setCurrentOrgRole(null)
      setLoading(false)
      lastFetchedUserId.current = null
      return
    }

    if (lastFetchedUserId.current === user.id || isFetching.current) {
      setLoading(false)
      return
    }

    try {
      isFetching.current = true
      setLoading(true)
      setError(null)

      const supabase = createClient()

      console.log("[v0] OrganizationContext: Fetching memberships for user:", user.id)

      const { data: membershipData, error: membershipError } = await supabase
        .from("organization_members")
        .select(`
          id,
          org_id,
          user_id,
          role,
          invited_by,
          invited_at,
          joined_at,
          organizations!organization_members_org_id_fkey (
            id,
            name,
            slug,
            type,
            settings,
            created_at,
            updated_at
          )
        `)
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })

      console.log("[v0] OrganizationContext: membershipData:", membershipData)
      console.log("[v0] OrganizationContext: membershipError:", membershipError)

      if (membershipError) {
        console.log("[v0] OrganizationContext: Failed to load - error:", membershipError)
        setError("Failed to load organizations")
        setLoading(false)
        isFetching.current = false
        return
      }

      lastFetchedUserId.current = user.id

      const rawMemberships = membershipData || []

      type RawMembership = {
        id: string
        org_id: string
        user_id: string
        role: string
        invited_by: string | null
        invited_at: string | null
        joined_at: string
        organizations: Organization | Organization[] | null
      }

      // Supabase may return organizations as an object or array depending on the join
      const fetchedMemberships = (rawMemberships as RawMembership[]).map((m: RawMembership) => {
        // Handle organizations being either an array or single object from Supabase join
        const orgData = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations

        return {
          id: String(m.id),
          org_id: String(m.org_id),
          user_id: String(m.user_id),
          role: m.role as OrgRole,
          invited_by: m.invited_by ? String(m.invited_by) : null,
          invited_at: m.invited_at ? String(m.invited_at) : null,
          joined_at: String(m.joined_at),
          organizations: orgData as Organization | null,
        }
      })

      type FetchedMembership = {
        id: string
        org_id: string
        user_id: string
        role: OrgRole
        invited_by: string | null
        invited_at: string | null
        joined_at: string
        organizations: Organization | null
      }

      const fetchedOrgs = fetchedMemberships
        .map((m: FetchedMembership) => m.organizations)
        .filter((org): org is Organization => org !== null)

      setMemberships(
        fetchedMemberships.map((m: FetchedMembership) => ({
          id: m.id,
          org_id: m.org_id,
          user_id: m.user_id,
          role: m.role,
          invited_by: m.invited_by ?? undefined,
          invited_at: m.invited_at ?? undefined,
          joined_at: m.joined_at,
          organization: m.organizations ?? undefined,
        })),
      )
      setOrganizations(fetchedOrgs)

      // Determine current organization
      const storedOrgId = typeof window !== "undefined" ? localStorage.getItem(ORG_STORAGE_KEY) : null

      let selectedOrg: Organization | null = null
      let selectedRole: OrgRole | null = null

      if (storedOrgId) {
        const membership = fetchedMemberships.find((m: FetchedMembership) => m.org_id === storedOrgId)
        if (membership && membership.organizations) {
          selectedOrg = membership.organizations
          selectedRole = membership.role
        }
      }

      if (!selectedOrg && fetchedOrgs.length > 0) {
        // Default to personal org or first org
        const personalOrg = fetchedOrgs.find((o: Organization) => o.type === "personal")
        if (personalOrg) {
          const membership = fetchedMemberships.find((m: FetchedMembership) => m.org_id === personalOrg.id)
          selectedOrg = personalOrg
          selectedRole = membership?.role ?? "owner"
        } else {
          const firstMembership = fetchedMemberships[0]
          if (firstMembership?.organizations) {
            selectedOrg = firstMembership.organizations
            selectedRole = firstMembership.role
          }
        }
      }

      setCurrentOrg(selectedOrg)
      setCurrentOrgRole(selectedRole)

      if (selectedOrg && typeof window !== "undefined") {
        localStorage.setItem(ORG_STORAGE_KEY, selectedOrg.id)
        document.cookie = `current_org_id=${selectedOrg.id}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
      }
    } catch (err) {
      setError("Failed to load organizations")
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [user])

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

      if (typeof window !== "undefined") {
        localStorage.setItem(ORG_STORAGE_KEY, orgId)
        document.cookie = `current_org_id=${orgId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
      }

      // Dispatch custom event for other components to react
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("organizationChanged", { detail: { orgId } }))
      }
    },
    [memberships, organizations],
  )

  // Create a new organization
  const createOrganization = useCallback(
    async (name: string, type: "team" | "enterprise" = "team"): Promise<Organization | null> => {
      if (!user) {
        setError("Must be logged in to create an organization")
        return null
      }

      try {
        const supabase = createClient()
        // Generate slug from name
        const slug =
          name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") +
          "-" +
          Math.random().toString(36).substring(2, 7)

        // Create organization
        const { data: newOrg, error: createError } = await supabase
          .from("organizations")
          .insert({
            name,
            slug,
            type,
            settings: {},
          })
          .select()
          .single()

        if (createError) {
          setError("Failed to create organization")
          return null
        }

        const { error: memberError } = await supabase.from("organization_members").insert({
          org_id: newOrg.id,
          user_id: user.id,
          role: "owner",
          joined_at: new Date().toISOString(),
        })

        if (memberError) {
          // Try to clean up
          await supabase.from("organizations").delete().eq("id", newOrg.id)
          setError("Failed to create organization")
          return null
        }

        lastFetchedUserId.current = null
        isFetching.current = false

        // Refresh organizations list
        await fetchOrganizations()

        return newOrg as Organization
      } catch (err) {
        setError("Failed to create organization")
        return null
      }
    },
    [user, fetchOrganizations],
  )

  // Refresh organizations
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

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider")
  }
  return context
}

export default OrganizationProvider
