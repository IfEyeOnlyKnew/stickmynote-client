import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// Helper: Build preregistration info object
function buildPreregistrationInfo(preRegRecord: { status?: string; role?: string; invited_at?: string } | null) {
  return {
    is_preregistered: preRegRecord?.status === "pre_registered" || preRegRecord?.status === "accepted",
    status: preRegRecord?.status ?? null,
    role: preRegRecord?.role ?? null,
    invited_at: preRegRecord?.invited_at ?? null,
    record_exists: !!preRegRecord,
  }
}

// Helper: Build organization info object
function buildOrganizationInfo(
  orgData: { id?: string; name?: string; domain?: string; require_preregistration?: boolean } | null,
  allowedDomains: string[],
) {
  return {
    org_id: orgData?.id,
    org_name: orgData?.name,
    require_preregistration: orgData?.require_preregistration ?? false,
    domain: orgData?.domain,
    allowed_domains: allowedDomains,
  }
}

// Helper: Build membership info object
function buildMembershipInfo(memberRecord: { role?: string; status?: string; joined_at?: string } | null) {
  if (!memberRecord) {
    return { is_member: false, role: null, status: null, joined_at: null }
  }
  return {
    is_member: true,
    role: memberRecord.role,
    status: memberRecord.status,
    joined_at: memberRecord.joined_at,
  }
}

// Helper: Calculate lockout expiration
function calculateLockoutExpiration(
  isLockedOut: boolean,
  lastFailedAttempt: string | null,
  lockoutDurationMinutes: number,
): string | null {
  if (!isLockedOut || !lastFailedAttempt) return null
  const lastAttemptTime = new Date(lastFailedAttempt).getTime()
  return new Date(lastAttemptTime + lockoutDurationMinutes * 60 * 1000).toISOString()
}

// Helper: Build user not found message
function buildUserNotFoundMessage(
  preRegRecord: { status?: string } | null,
  requirePreregistration: boolean,
): string {
  if (preRegRecord) {
    const statusText = preRegRecord.status === "pre_registered" ? "pre-registered" : preRegRecord.status
    return `Email is ${statusText} but user has not signed up yet`
  }
  if (requirePreregistration) {
    return "Email is NOT pre-registered. User will be denied access when they try to sign up."
  }
  return "Email is not pre-registered, but pre-registration is not required. User can sign up freely."
}

// Helper: Validate email domain against allowed domains
function validateEmailDomain(
  emailDomain: string,
  allowedDomains: string[],
): { valid: boolean; error?: NextResponse } {
  if (allowedDomains.length === 0) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "No domains configured for this organization. Please add domains in the General tab first.", allowed_domains: [] },
        { status: 400 },
      ),
    }
  }
  if (!allowedDomains.includes(emailDomain)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: `Email domain "${emailDomain}" is not in this organization's allowed domains`, allowed_domains: allowedDomains, searched_domain: emailDomain },
        { status: 400 },
      ),
    }
  }
  return { valid: true }
}

export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const { data: orgMember, error: orgError } = await db
      .from("organization_members")
      .select("role, org_id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle()

    if (orgError || !orgMember) {
      return NextResponse.json({ error: "Only organization owners can access this feature" }, { status: 403 })
    }

    const email = request.nextUrl.searchParams.get("email")
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const emailDomain = email.split("@")[1]?.toLowerCase()
    if (!emailDomain) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const { data: orgDomains } = await db
      .from("organization_domains")
      .select("domain")
      .eq("org_id", orgMember.org_id)

    const allowedDomains = orgDomains?.map((d: { domain: string }) => d.domain.toLowerCase()) || []

    const domainValidation = validateEmailDomain(emailDomain, allowedDomains)
    if (!domainValidation.valid) {
      return domainValidation.error
    }

    // Fetch all required data in parallel
    const [preRegResult, userResult, orgResult, memberUserResult] = await Promise.all([
      db.from("organization_invites").select("id, email, role, status, invited_at, invited_by").eq("org_id", orgMember.org_id).ilike("email", email).maybeSingle(),
      db.from("users").select("id, email, full_name, avatar_url, created_at, updated_at, phone, hub_mode, region, division").ilike("email", email).limit(1).maybeSingle(),
      db.from("organizations").select("id, name, max_failed_attempts, lockout_duration_minutes, require_preregistration, domain").eq("id", orgMember.org_id).single(),
      db.from("users").select("id").ilike("email", email).maybeSingle(),
    ])

    const preRegRecord = preRegResult.data
    const foundUser = userResult.data
    const orgData = orgResult.data

    const maxFailedAttempts = orgData?.max_failed_attempts ?? 5
    const lockoutDurationMinutes = orgData?.lockout_duration_minutes ?? 15
    const requirePreregistration = orgData?.require_preregistration ?? false

    // Fetch member record if user exists
    const { data: memberRecord } = await db
      .from("organization_members")
      .select("id, role, status, joined_at, user_id")
      .eq("org_id", orgMember.org_id)
      .eq("user_id", memberUserResult.data?.id ?? "")
      .maybeSingle()

    if (!foundUser) {
      return NextResponse.json({
        user: null,
        email,
        preregistration_info: buildPreregistrationInfo(preRegRecord),
        organization_info: buildOrganizationInfo(orgData, allowedDomains),
        membership_info: null,
        message: buildUserNotFoundMessage(preRegRecord, requirePreregistration),
      })
    }

    const emailVerified = !!(foundUser.full_name || foundUser.hub_mode)
    const lockoutWindow = new Date(Date.now() - lockoutDurationMinutes * 60 * 1000).toISOString()

    const { data: failedAttempts } = await db
      .from("login_attempts")
      .select("id, attempted_at, success")
      .eq("email", foundUser.email.toLowerCase())
      .eq("success", false)
      .gte("attempted_at", lockoutWindow)
      .order("attempted_at", { ascending: false })

    const failedAttemptCount = failedAttempts?.length ?? 0
    const isLockedOut = failedAttemptCount >= maxFailedAttempts
    const lastFailedAttempt = failedAttempts?.[0]?.attempted_at ?? null
    const lockoutExpiresAt = calculateLockoutExpiration(isLockedOut, lastFailedAttempt, lockoutDurationMinutes)

    return NextResponse.json({
      user: {
        ...foundUser,
        email_verified: emailVerified,
        lockout_info: {
          is_locked_out: isLockedOut,
          failed_attempt_count: failedAttemptCount,
          max_failed_attempts: maxFailedAttempts,
          lockout_duration_minutes: lockoutDurationMinutes,
          lockout_expires_at: lockoutExpiresAt,
          last_failed_attempt: lastFailedAttempt,
        },
      },
      preregistration_info: buildPreregistrationInfo(preRegRecord),
      organization_info: buildOrganizationInfo(orgData, allowedDomains),
      membership_info: buildMembershipInfo(memberRecord),
    })
  } catch (error) {
    console.error("Error looking up user:", error)
    return NextResponse.json({ error: "Failed to look up user" }, { status: 500 })
  }
}
