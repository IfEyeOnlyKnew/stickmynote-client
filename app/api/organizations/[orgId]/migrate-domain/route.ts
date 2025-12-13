import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createServerClient } from "@/lib/supabase/server"

interface OrgMember {
  user_id: string
}

interface PublicUser {
  id: string
  email: string | null
}

interface OrgInvite {
  id: string
  email: string | null
}

interface OrgDomain {
  id: string
  domain: string
}

interface MigrationResult {
  success: boolean
  authUsersUpdated: number
  publicUsersUpdated: number
  invitesUpdated: number
  membersUpdated: number
  domainsUpdated: boolean
  errors: string[]
  details: {
    authUsers: string[]
    publicUsers: string[]
    invites: string[]
    members: string[]
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const body = await request.json()
    const { oldDomain, newDomain, newOrgName, dryRun = true } = body

    // Validate inputs
    if (!oldDomain || !newDomain) {
      return NextResponse.json({ error: "Old domain and new domain are required" }, { status: 400 })
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/
    if (!domainRegex.test(oldDomain) || !domainRegex.test(newDomain)) {
      return NextResponse.json({ error: "Invalid domain format" }, { status: 400 })
    }

    // Verify user is authorized (owner or support contact)
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is owner
    const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single()

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const isOwner = org.owner_id === user.id
    const isSupportContact = user.email === org.support_contact_1_email || user.email === org.support_contact_2_email

    if (!isOwner && !isSupportContact) {
      return NextResponse.json({ error: "Only owners and support contacts can migrate domains" }, { status: 403 })
    }

    // Use service client for admin operations
    const serviceClient = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = serviceClient as any

    const result: MigrationResult = {
      success: true,
      authUsersUpdated: 0,
      publicUsersUpdated: 0,
      invitesUpdated: 0,
      membersUpdated: 0,
      domainsUpdated: false,
      errors: [],
      details: {
        authUsers: [],
        publicUsers: [],
        invites: [],
        members: [],
      },
    }

    const { data: members, error: membersError } = await db
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)

    if (membersError) {
      result.errors.push(`Failed to fetch members: ${membersError.message}`)
    }

    const memberUserIds = (members as OrgMember[] | null)?.map((m) => m.user_id) || []

    let publicUsers: PublicUser[] = []
    if (memberUserIds.length > 0) {
      const { data: pubUsersData, error: pubUsersError } = await db
        .from("users")
        .select("id, email")
        .like("email", `%@${oldDomain}`)
        .in("id", memberUserIds)

      if (pubUsersError) {
        result.errors.push(`Failed to fetch public users: ${pubUsersError.message}`)
      } else {
        publicUsers = (pubUsersData as PublicUser[]) || []
      }
    }

    const { data: invitesData, error: invitesError } = await db
      .from("organization_invites")
      .select("id, email")
      .eq("org_id", orgId)
      .like("email", `%@${oldDomain}`)

    if (invitesError) {
      result.errors.push(`Failed to fetch invites: ${invitesError.message}`)
    }
    const invites = (invitesData as OrgInvite[]) || []

    const { data: domainsData, error: domainsError } = await db
      .from("organization_domains")
      .select("id, domain")
      .eq("org_id", orgId)
      .eq("domain", oldDomain)

    if (domainsError) {
      result.errors.push(`Failed to fetch domains: ${domainsError.message}`)
    }
    const existingDomains = (domainsData as OrgDomain[]) || []

    // List auth users and filter by old domain and membership
    const { data: authData, error: authError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    if (authError) {
      result.errors.push(`Failed to fetch auth users: ${authError.message}`)
    }
    const authUsers =
      authData?.users.filter((u) => u.email?.endsWith(`@${oldDomain}`) && memberUserIds.includes(u.id)) || []

    if (dryRun) {
      // Return preview of what would be changed
      return NextResponse.json({
        dryRun: true,
        preview: {
          authUsers: authUsers.map((u) => ({
            id: u.id,
            oldEmail: u.email,
            newEmail: u.email?.replace(`@${oldDomain}`, `@${newDomain}`),
          })),
          publicUsers: publicUsers.map((u) => ({
            id: u.id,
            oldEmail: u.email,
            newEmail: u.email?.replace(`@${oldDomain}`, `@${newDomain}`),
          })),
          invites: invites.map((i) => ({
            id: i.id,
            oldEmail: i.email,
            newEmail: i.email?.replace(`@${oldDomain}`, `@${newDomain}`),
          })),
          domains:
            existingDomains.length > 0
              ? { oldDomain, newDomain, action: "update" }
              : { oldDomain, newDomain, action: "create" },
          totalAffected: {
            authUsers: authUsers.length,
            publicUsers: publicUsers.length,
            invites: invites.length,
            domains: existingDomains.length > 0 ? 1 : 0,
          },
        },
      })
    }

    // Execute the migration
    for (const authUser of authUsers) {
      const newEmail = authUser.email?.replace(`@${oldDomain}`, `@${newDomain}`)
      if (newEmail && authUser.email) {
        const { error } = await serviceClient.auth.admin.updateUserById(authUser.id, {
          email: newEmail,
          email_confirm: true,
        })
        if (error) {
          result.errors.push(`Auth user ${authUser.email}: ${error.message}`)
        } else {
          result.authUsersUpdated++
          result.details.authUsers.push(`${authUser.email} → ${newEmail}`)
        }
      }
    }

    for (const pubUser of publicUsers) {
      const newEmail = pubUser.email?.replace(`@${oldDomain}`, `@${newDomain}`)
      if (newEmail && pubUser.email) {
        const { error } = await db.from("users").update({ email: newEmail }).eq("id", pubUser.id)
        if (error) {
          result.errors.push(`Public user ${pubUser.email}: ${error.message}`)
        } else {
          result.publicUsersUpdated++
          result.details.publicUsers.push(`${pubUser.email} → ${newEmail}`)
        }
      }
    }

    for (const invite of invites) {
      const newEmail = invite.email?.replace(`@${oldDomain}`, `@${newDomain}`)
      if (newEmail && invite.email) {
        const { error } = await db.from("organization_invites").update({ email: newEmail }).eq("id", invite.id)
        if (error) {
          result.errors.push(`Invite ${invite.email}: ${error.message}`)
        } else {
          result.invitesUpdated++
          result.details.invites.push(`${invite.email} → ${newEmail}`)
        }
      }
    }

    if (existingDomains.length > 0) {
      const { error } = await db
        .from("organization_domains")
        .update({ domain: newDomain })
        .eq("id", existingDomains[0].id)
      if (error) {
        result.errors.push(`Domain update: ${error.message}`)
      } else {
        result.domainsUpdated = true
      }
    } else {
      // Insert new domain if old one doesn't exist
      const { error } = await db.from("organization_domains").insert({
        org_id: orgId,
        domain: newDomain,
        is_primary: true,
      })
      if (error && !error.message?.includes("duplicate")) {
        result.errors.push(`Domain insert: ${error.message}`)
      } else {
        result.domainsUpdated = true
      }
    }

    if (newOrgName) {
      const { error } = await db.from("organizations").update({ name: newOrgName }).eq("id", orgId)
      if (error) {
        result.errors.push(`Organization name update: ${error.message}`)
      }
    }

    result.success = result.errors.length === 0

    return NextResponse.json(result)
  } catch (error) {
    console.error("Domain migration error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Migration failed" }, { status: 500 })
  }
}
