// Admin handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'

export interface AdminUser {
  id: string
}

// ============================================================================
// Helper functions
// ============================================================================

export function buildPreregistrationInfo(
  preRegRecord: { status?: string; role?: string; invited_at?: string } | null,
) {
  return {
    is_preregistered:
      preRegRecord?.status === 'pre_registered' || preRegRecord?.status === 'accepted',
    status: preRegRecord?.status ?? null,
    role: preRegRecord?.role ?? null,
    invited_at: preRegRecord?.invited_at ?? null,
    record_exists: !!preRegRecord,
  }
}

export function buildOrganizationInfo(
  orgData: {
    id?: string
    name?: string
    domain?: string
    require_preregistration?: boolean
  } | null,
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

export function buildMembershipInfo(
  memberRecord: { role?: string; status?: string; joined_at?: string } | null,
) {
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

export function calculateLockoutExpiration(
  isLockedOut: boolean,
  lastFailedAttempt: string | null,
  lockoutDurationMinutes: number,
): string | null {
  if (!isLockedOut || !lastFailedAttempt) return null
  const lastAttemptTime = new Date(lastFailedAttempt).getTime()
  return new Date(lastAttemptTime + lockoutDurationMinutes * 60 * 1000).toISOString()
}

export function buildUserNotFoundMessage(
  preRegRecord: { status?: string } | null,
  requirePreregistration: boolean,
): string {
  if (preRegRecord) {
    const statusText =
      preRegRecord.status === 'pre_registered' ? 'pre-registered' : preRegRecord.status
    return `Email is ${statusText} but user has not signed up yet`
  }
  if (requirePreregistration) {
    return 'Email is NOT pre-registered. User will be denied access when they try to sign up.'
  }
  return 'Email is not pre-registered, but pre-registration is not required. User can sign up freely.'
}

// ============================================================================
// GET: User lookup by email
// ============================================================================

export async function lookupUser(user: AdminUser, email: string) {
  // Check if user is an organization owner
  const orgMemberResult = await db.query(
    `SELECT role, org_id FROM organization_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
    [user.id],
  )

  if (orgMemberResult.rows.length === 0) {
    return { error: 'Only organization owners can access this feature', status: 403 }
  }

  const orgMember = orgMemberResult.rows[0]

  if (!email) {
    return { error: 'Email is required', status: 400 }
  }

  const emailDomain = email.split('@')[1]?.toLowerCase()
  if (!emailDomain) {
    return { error: 'Invalid email format', status: 400 }
  }

  // Get allowed domains
  const domainsResult = await db.query(
    `SELECT domain FROM organization_domains WHERE org_id = $1`,
    [orgMember.org_id],
  )
  const allowedDomains = domainsResult.rows.map((d: { domain: string }) => d.domain.toLowerCase())

  // Validate email domain
  if (allowedDomains.length === 0) {
    return {
      error:
        'No domains configured for this organization. Please add domains in the General tab first.',
      data: { allowed_domains: [] },
      status: 400,
    }
  }

  if (!allowedDomains.includes(emailDomain)) {
    return {
      error: `Email domain "${emailDomain}" is not in this organization's allowed domains`,
      data: { allowed_domains: allowedDomains, searched_domain: emailDomain },
      status: 400,
    }
  }

  // Fetch preregistration info
  const preRegResult = await db.query(
    `SELECT id, email, role, status, invited_at, invited_by
     FROM organization_invites
     WHERE org_id = $1 AND LOWER(email) = LOWER($2)
     LIMIT 1`,
    [orgMember.org_id, email],
  )
  const preRegRecord = preRegResult.rows[0] || null

  // Fetch user info
  const userResult = await db.query(
    `SELECT id, email, full_name, avatar_url, created_at, updated_at, phone, hub_mode, region, division
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email],
  )
  const foundUser = userResult.rows[0] || null

  // Fetch organization info
  const orgResult = await db.query(
    `SELECT id, name, max_failed_attempts, lockout_duration_minutes, require_preregistration, domain
     FROM organizations
     WHERE id = $1`,
    [orgMember.org_id],
  )
  const orgData = orgResult.rows[0] || null

  const maxFailedAttempts = orgData?.max_failed_attempts ?? 5
  const lockoutDurationMinutes = orgData?.lockout_duration_minutes ?? 15
  const requirePreregistration = orgData?.require_preregistration ?? false

  // Fetch member record if user exists
  let memberRecord = null
  if (foundUser) {
    const memberResult = await db.query(
      `SELECT id, role, status, joined_at, user_id
       FROM organization_members
       WHERE org_id = $1 AND user_id = $2
       LIMIT 1`,
      [orgMember.org_id, foundUser.id],
    )
    memberRecord = memberResult.rows[0] || null
  }

  if (!foundUser) {
    return {
      data: {
        user: null,
        email,
        preregistration_info: buildPreregistrationInfo(preRegRecord),
        organization_info: buildOrganizationInfo(orgData, allowedDomains),
        membership_info: null,
        message: buildUserNotFoundMessage(preRegRecord, requirePreregistration),
      },
      status: 200,
    }
  }

  const emailVerified = !!(foundUser.full_name || foundUser.hub_mode)
  const lockoutWindow = new Date(
    Date.now() - lockoutDurationMinutes * 60 * 1000,
  ).toISOString()

  // Fetch failed login attempts
  const failedAttemptsResult = await db.query(
    `SELECT id, attempted_at, success
     FROM login_attempts
     WHERE email = $1 AND success = false AND attempted_at >= $2
     ORDER BY attempted_at DESC`,
    [foundUser.email.toLowerCase(), lockoutWindow],
  )

  const failedAttemptCount = failedAttemptsResult.rows.length
  const isLockedOut = failedAttemptCount >= maxFailedAttempts
  const lastFailedAttempt = failedAttemptsResult.rows[0]?.attempted_at ?? null
  const lockoutExpiresAt = calculateLockoutExpiration(
    isLockedOut,
    lastFailedAttempt,
    lockoutDurationMinutes,
  )

  return {
    data: {
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
    },
    status: 200,
  }
}
