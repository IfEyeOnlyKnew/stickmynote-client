import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const authResult = await getCachedAuthUser(supabase)
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

    const { data: orgMember, error: orgError } = await supabase
      .from("organization_members")
      .select("role, org_id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle()

    if (orgError || !orgMember) {
      return NextResponse.json({ error: "Only organization owners can access this feature" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const emailDomain = email.split("@")[1]?.toLowerCase()
    if (!emailDomain) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Fetch organization's allowed domains
    const { data: orgDomains } = await supabase
      .from("organization_domains")
      .select("domain")
      .eq("org_id", orgMember.org_id)

    const allowedDomains = orgDomains?.map((d) => d.domain.toLowerCase()) || []

    // Check if the email domain is in the organization's allowed domains
    if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
      return NextResponse.json(
        {
          error: `Email domain "${emailDomain}" is not in this organization's allowed domains`,
          allowed_domains: allowedDomains,
          searched_domain: emailDomain,
        },
        { status: 400 },
      )
    }

    // If no domains configured, return a helpful message
    if (allowedDomains.length === 0) {
      return NextResponse.json(
        {
          error: "No domains configured for this organization. Please add domains in the General tab first.",
          allowed_domains: [],
        },
        { status: 400 },
      )
    }
    // </CHANGE>

    const { data: preRegRecord } = await supabase
      .from("organization_invites")
      .select("id, email, role, status, invited_at, invited_by")
      .eq("org_id", orgMember.org_id)
      .ilike("email", email)
      .maybeSingle()

    const { data: memberRecord } = await supabase
      .from("organization_members")
      .select("id, role, status, joined_at, user_id")
      .eq("org_id", orgMember.org_id)
      .eq("user_id", (await supabase.from("users").select("id").ilike("email", email).maybeSingle()).data?.id ?? "")
      .maybeSingle()

    const { data: foundUser, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, avatar_url, created_at, updated_at, phone, hub_mode, region, division")
      .ilike("email", email)
      .limit(1)
      .maybeSingle()

    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name, max_failed_attempts, lockout_duration_minutes, require_preregistration, domain")
      .eq("id", orgMember.org_id)
      .single()

    const maxFailedAttempts = orgData?.max_failed_attempts ?? 5
    const lockoutDurationMinutes = orgData?.lockout_duration_minutes ?? 15
    const requirePreregistration = orgData?.require_preregistration ?? false

    if (userError || !foundUser) {
      // Return pre-registration status even if user hasn't signed up yet
      return NextResponse.json({
        user: null,
        email: email,
        preregistration_info: {
          is_preregistered: preRegRecord?.status === "pre_registered",
          status: preRegRecord?.status ?? null,
          role: preRegRecord?.role ?? null,
          invited_at: preRegRecord?.invited_at ?? null,
          record_exists: !!preRegRecord,
        },
        organization_info: {
          org_id: orgData?.id,
          org_name: orgData?.name,
          require_preregistration: requirePreregistration,
          domain: orgData?.domain,
          allowed_domains: allowedDomains,
        },
        membership_info: null,
        message: preRegRecord
          ? `Email is ${preRegRecord.status === "pre_registered" ? "pre-registered" : preRegRecord.status} but user has not signed up yet`
          : requirePreregistration
            ? "Email is NOT pre-registered. User will be denied access when they try to sign up."
            : "Email is not pre-registered, but pre-registration is not required. User can sign up freely.",
      })
    }

    // Check email verification status
    const emailVerified = !!(foundUser.full_name || foundUser.hub_mode)

    // Get recent failed login attempts for this user
    const lockoutWindow = new Date(Date.now() - lockoutDurationMinutes * 60 * 1000).toISOString()

    const { data: failedAttempts } = await supabase
      .from("login_attempts")
      .select("id, attempted_at, success")
      .eq("email", foundUser.email.toLowerCase())
      .eq("success", false)
      .gte("attempted_at", lockoutWindow)
      .order("attempted_at", { ascending: false })

    const failedAttemptCount = failedAttempts?.length ?? 0
    const isLockedOut = failedAttemptCount >= maxFailedAttempts

    const lastFailedAttempt = failedAttempts?.[0]?.attempted_at ?? null

    let lockoutExpiresAt = null
    if (isLockedOut && lastFailedAttempt) {
      const lastAttemptTime = new Date(lastFailedAttempt).getTime()
      lockoutExpiresAt = new Date(lastAttemptTime + lockoutDurationMinutes * 60 * 1000).toISOString()
    }

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
      preregistration_info: {
        is_preregistered: preRegRecord?.status === "pre_registered" || preRegRecord?.status === "accepted",
        status: preRegRecord?.status ?? null,
        role: preRegRecord?.role ?? null,
        invited_at: preRegRecord?.invited_at ?? null,
        record_exists: !!preRegRecord,
      },
      organization_info: {
        org_id: orgData?.id,
        org_name: orgData?.name,
        require_preregistration: requirePreregistration,
        domain: orgData?.domain,
        allowed_domains: allowedDomains,
      },
      membership_info: memberRecord
        ? {
            is_member: true,
            role: memberRecord.role,
            status: memberRecord.status,
            joined_at: memberRecord.joined_at,
          }
        : {
            is_member: false,
            role: null,
            status: null,
            joined_at: null,
          },
    })
  } catch (error) {
    console.error("Error looking up user:", error)
    return NextResponse.json({ error: "Failed to look up user" }, { status: 500 })
  }
}
