import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { type NextRequest, NextResponse } from "next/server"
import { extractDomain, isPublicEmailDomain, generateOrgNameFromDomain } from "@/lib/utils/email-domain"
import { getSession } from "@/lib/auth/local-auth"

/**
 * Auth Callback Route
 * 
 * For local auth, this handles post-login redirects and processes:
 * - Hub mode setup based on email domain
 * - Organization membership (auto-join or pre-registration)
 * - Pending pad invites
 * - Pending social pad invites
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin
  const redirectTo = requestUrl.searchParams.get("redirectTo") || "/dashboard"

  // Check for authenticated session
  const session = await getSession()

  if (!session) {
    return NextResponse.redirect(`${origin}/auth/login?error=not_authenticated`)
  }

  try {
    const db = await createServiceDatabaseClient()
    const userEmail = session.user.email
    const userId = session.user.id

    if (!userEmail) {
      // No email - redirect to personal
      return NextResponse.redirect(`${origin}/personal`)
    }

    const domain = extractDomain(userEmail)
    const isPersonalEmail = !domain || isPublicEmailDomain(domain)
    const defaultHubMode = isPersonalEmail ? "personal_only" : "full_access"

    // Check current user profile
    const { data: userProfile, error: profileError } = await db
      .from("users")
      .select("id, hub_mode")
      .eq("id", userId)
      .single()

    if (profileError) {
      console.error("[Auth Callback] Error fetching user profile:", profileError)
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }

    // Set hub_mode if not already set
    if (!userProfile.hub_mode) {
      console.log(`[Auth Callback] Setting hub_mode to ${defaultHubMode} for ${userEmail}`)

      await db
        .from("users")
        .update({ hub_mode: defaultHubMode })
        .eq("id", userId)
    }

    const effectiveHubMode = userProfile.hub_mode || defaultHubMode

    // Process organization membership for business emails
    if (effectiveHubMode === "full_access" && domain && !isPersonalEmail) {
      try {
        await processOrganizationMembership(db, userId, userEmail, domain)
      } catch (orgError) {
        console.error("[Auth Callback] Error processing organization:", orgError)
        // Don't fail the login
      }
    }

    // Process pending invites
    try {
      await processPendingInvites(db, userId, userEmail)
    } catch (inviteError) {
      console.error("[Auth Callback] Error processing invitations:", inviteError)
      // Don't fail the login
    }

    // Redirect based on hub_mode
    const finalRedirect = effectiveHubMode === "personal_only" ? "/personal" : redirectTo

    return NextResponse.redirect(`${origin}${finalRedirect}`)

  } catch (err) {
    console.error("Auth callback - Unexpected error:", err)
    return NextResponse.redirect(`${origin}/auth/login?error=callback_error`)
  }
}

// ============================================================================
// Organization Membership Helpers
// ============================================================================

async function checkExistingMembership(db: any, userId: string): Promise<{ orgId: string } | null> {
  const { data } = await db
    .from("organization_members")
    .select("id, org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  return data ? { orgId: data.org_id } : null
}

async function findOrganizationByDomain(db: any, domain: string) {
  const { data, error } = await db
    .from("organizations")
    .select("id, name, require_preregistration")
    .eq("domain", domain)
    .maybeSingle()

  if (error) {
    console.error("[Auth Callback] Error finding organization:", error)
    return null
  }
  return data
}

async function findPreRegistration(db: any, orgId: string, email: string) {
  const { data } = await db
    .from("organization_invites")
    .select("id, role")
    .eq("org_id", orgId)
    .eq("email", email.toLowerCase())
    .eq("status", "pre_registered")
    .maybeSingle()

  return data
}

async function addMemberToOrg(
  db: any,
  orgId: string,
  userId: string,
  role: string,
  status?: string
): Promise<boolean> {
  const { error } = await db.from("organization_members").insert({
    org_id: orgId,
    user_id: userId,
    role,
    ...(status && { status }),
    joined_at: new Date().toISOString(),
  })
  return !error
}

async function handlePreRegisteredOrg(
  db: any,
  org: { id: string; name: string },
  userId: string,
  userEmail: string
): Promise<void> {
  const preRegistration = await findPreRegistration(db, org.id, userEmail)

  if (!preRegistration) {
    console.log(`[Auth Callback] User ${userEmail} is NOT pre-registered for ${org.name}`)
    await db.from("users").update({ hub_mode: "personal_only" }).eq("id", userId)
    return
  }

  const added = await addMemberToOrg(db, org.id, userId, preRegistration.role || "member", "active")
  if (added) {
    console.log(`[Auth Callback] Added pre-registered user to organization: ${org.name}`)
    await db.from("organization_invites").update({ status: "accepted" }).eq("id", preRegistration.id)
  }
}

async function handleAutoJoinOrg(
  db: any,
  org: { id: string; name: string },
  userId: string
): Promise<void> {
  const added = await addMemberToOrg(db, org.id, userId, "member")
  if (added) {
    console.log(`[Auth Callback] Added user to existing organization: ${org.name}`)
  }
}

async function createNewOrganization(
  db: any,
  userId: string,
  domain: string
): Promise<void> {
  const orgName = generateOrgNameFromDomain(domain)
  const slug = `${domain.replaceAll(".", "-")}-${Math.random().toString(36).substring(2, 7)}`

  const { data: newOrg, error } = await db
    .from("organizations")
    .insert({
      name: orgName,
      slug,
      type: "team",
      domain,
      owner_id: userId,
      settings: {},
      require_preregistration: true,
    })
    .select()
    .single()

  if (error || !newOrg) return

  await addMemberToOrg(db, newOrg.id, userId, "owner")
  console.log(`[Auth Callback] Created new organization: ${orgName} for domain ${domain}`)
}

// ============================================================================
// Main Organization Membership Processor
// ============================================================================

/**
 * Process organization membership for business email domains
 */
async function processOrganizationMembership(
  db: any,
  userId: string,
  userEmail: string,
  domain: string
): Promise<void> {
  // Check if user already has any organization membership
  const existing = await checkExistingMembership(db, userId)
  if (existing) {
    console.log(`[Auth Callback] User already has organization membership: ${existing.orgId}`)
    return
  }

  console.log(`[Auth Callback] User has no organization, checking for domain org: ${domain}`)

  // Check if organization exists for this domain
  const existingOrg = await findOrganizationByDomain(db, domain)

  if (!existingOrg) {
    await createNewOrganization(db, userId, domain)
    return
  }

  if (existingOrg.require_preregistration) {
    await handlePreRegisteredOrg(db, existingOrg, userId, userEmail)
  } else {
    await handleAutoJoinOrg(db, existingOrg, userId)
  }
}

/**
 * Process pending pad and social pad invites
 */
async function processPendingInvites(db: any, userId: string, userEmail: string): Promise<void> {
  // Process pad pending invites
  const { data: padInvites } = await db
    .from("paks_pad_pending_invites")
    .select("*")
    .eq("email", userEmail)

  if (padInvites && padInvites.length > 0) {
    console.log(`[Auth Callback] Processing ${padInvites.length} pad invitation(s)`)

    for (const invite of padInvites) {
      const { error: memberError } = await db.from("paks_pad_members").insert({
        pad_id: invite.pad_id,
        user_id: userId,
        role: invite.role,
        accepted: true,
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
      })

      if (!memberError) {
        await db.from("paks_pad_pending_invites").delete().eq("id", invite.id)
        console.log(`[Auth Callback] Processed pad invite ${invite.id}`)
      }
    }
  }

  // Process social pad pending invites
  const { data: socialPadInvites } = await db
    .from("social_pad_pending_invites")
    .select("*")
    .eq("email", userEmail)

  if (socialPadInvites && socialPadInvites.length > 0) {
    console.log(`[Auth Callback] Processing ${socialPadInvites.length} social pad invitation(s)`)

    for (const invite of socialPadInvites) {
      const { error: memberError } = await db.from("social_pad_members").insert({
        social_pad_id: invite.social_pad_id,
        user_id: userId,
        role: invite.role,
        accepted: true,
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
      })

      if (!memberError) {
        await db.from("social_pad_pending_invites").delete().eq("id", invite.id)
        console.log(`[Auth Callback] Processed social pad invite ${invite.id}`)
      }
    }
  }
}
