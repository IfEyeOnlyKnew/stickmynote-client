// Inference Sticks handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext, type OrgContext } from '@/lib/auth/get-org-context'
import { publishToOrg } from '@/lib/ws/publish-event'

// ============================================================================
// Types
// ============================================================================

export interface InferenceStickUser {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

export interface EnrichedStick {
  id: string
  topic: string
  content: string
  social_pad_id: string
  user_id: string
  org_id: string
  color: string
  created_at: string
  updated_at: string
  users: InferenceStickUser | null
  reply_count: number
  social_pads?: { id: string; name: string; is_public?: boolean } | null
  [key: string]: unknown
}

export interface AuthenticatedContext {
  user: { id: string; email?: string }
  orgContext: OrgContext
}

export interface ListSticksParams {
  isPublic: boolean
  isAdmin: boolean
  isPrivate: boolean
  limit: number
  offset: number
  userId: string | null
}

export interface CreateStickInput {
  topic: string
  content?: string
  social_pad_id: string
  color?: string
}

// ============================================================================
// Constants
// ============================================================================

const ADMIN_EMAILS = new Set(['chrisdoran63@outlook.com'])
const DEFAULT_STICK_COLOR = '#fef3c7'

// ============================================================================
// Auth Helpers
// ============================================================================

export async function getAuthContext(): Promise<
  | { success: true; user: { id: string; email?: string }; orgContext: OrgContext | null }
  | { success: false; error: 'rate_limited' | 'unauthorized' }
> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return { success: false, error: 'rate_limited' }
  }
  if (!authResult.user) {
    return { success: false, error: 'unauthorized' }
  }

  let orgContext: OrgContext | null = null
  try {
    orgContext = await getOrgContext()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'RATE_LIMITED') {
      return { success: false, error: 'rate_limited' }
    }
    // No org context is OK for some flows
  }

  return { success: true, user: authResult.user, orgContext }
}

export async function getRequiredAuthContext(): Promise<
  | { success: true; context: AuthenticatedContext }
  | { success: false; error: 'rate_limited' | 'unauthorized' | 'no_org' }
> {
  const result = await getAuthContext()
  if (!result.success) return result
  if (!result.orgContext) return { success: false, error: 'no_org' }
  return { success: true, context: { user: result.user, orgContext: result.orgContext } }
}

// ============================================================================
// Shared enrichment
// ============================================================================

export async function enrichSticksWithData(sticks: any[]): Promise<EnrichedStick[]> {
  if (!sticks || sticks.length === 0) return []

  const userIds = [...new Set(sticks.map((s) => s.user_id).filter(Boolean))]
  const stickIds = sticks.map((s) => s.id)

  // Get users
  let usersMap = new Map<string, InferenceStickUser>()
  if (userIds.length > 0) {
    const usersResult = await db.query(
      `SELECT id, full_name, email, avatar_url FROM users WHERE id = ANY($1)`,
      [userIds]
    )
    usersMap = new Map(usersResult.rows.map((u: any) => [u.id, u]))
  }

  // Get reply counts
  let replyCountMap = new Map<string, number>()
  if (stickIds.length > 0) {
    const repliesResult = await db.query(
      `SELECT social_stick_id, COUNT(*) as count
       FROM social_stick_replies
       WHERE social_stick_id = ANY($1)
       GROUP BY social_stick_id`,
      [stickIds]
    )
    replyCountMap = new Map(
      repliesResult.rows.map((r: any) => [r.social_stick_id, Number.parseInt(r.count, 10)])
    )
  }

  return sticks.map((stick) => ({
    ...stick,
    users: usersMap.get(stick.user_id) || null,
    reply_count: replyCountMap.get(stick.id) || 0,
    social_pads: stick.pad_id
      ? { id: stick.pad_id, name: stick.pad_name, is_public: stick.is_public ?? stick.pad_is_public }
      : stick.social_pads || null,
  }))
}

// ============================================================================
// GET: List sticks
// ============================================================================

export async function listSticks(
  params: ListSticksParams,
  user: { id: string; email?: string } | null,
  orgContext: OrgContext | null
): Promise<{ status: number; body: any }> {
  const { isPublic, isAdmin, isPrivate, limit, offset, userId } = params

  // Public sticks - no auth required
  if (isPublic) {
    const result = await db.query(
      `SELECT ss.*, sp.id as pad_id, sp.name as pad_name, sp.is_public
       FROM social_sticks ss
       INNER JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE sp.is_public = true
       ORDER BY ss.created_at DESC`
    )
    const sticks = await enrichSticksWithData(result.rows)
    return { status: 200, body: { sticks } }
  }

  // All other requests require authentication
  if (!user) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  // Admin view
  if (isAdmin) {
    const isUserAdmin = user.email && ADMIN_EMAILS.has(user.email)
    if (!isUserAdmin) {
      return { status: 403, body: { error: 'Forbidden' } }
    }

    const result = await db.query(
      `SELECT ss.*, sp.id as pad_id, sp.name as pad_name
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       ORDER BY ss.created_at DESC`
    )
    const sticks = await enrichSticksWithData(result.rows)
    return { status: 200, body: { sticks } }
  }

  if (!orgContext) {
    // Fallback to public sticks only
    const result = await db.query(
      `SELECT ss.*, sp.id as pad_id, sp.name as pad_name
       FROM social_sticks ss
       INNER JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE sp.is_public = true
       ORDER BY ss.created_at DESC`
    )
    const sticks = await enrichSticksWithData(result.rows)
    return { status: 200, body: { sticks } }
  }

  // Private sticks only
  if (isPrivate) {
    const result = await db.query(
      `SELECT DISTINCT ss.*, sp.id as pad_id, sp.name as pad_name
       FROM social_sticks ss
       INNER JOIN social_pads sp ON ss.social_pad_id = sp.id
       LEFT JOIN social_pad_members spm ON sp.id = spm.social_pad_id AND spm.user_id = $1 AND spm.accepted = true
       WHERE ss.org_id = $2 AND sp.is_public = false
         AND (sp.owner_id = $1 OR spm.user_id IS NOT NULL)
       ORDER BY ss.created_at DESC`,
      [user.id, orgContext.orgId]
    )
    const sticks = await enrichSticksWithData(result.rows)
    return { status: 200, body: { sticks, hasMore: false } }
  }

  // Default: all accessible sticks (owned, member, and public)
  let query = `SELECT DISTINCT ss.*, sp.id as pad_id, sp.name as pad_name, sp.is_public
     FROM social_sticks ss
     INNER JOIN social_pads sp ON ss.social_pad_id = sp.id
     LEFT JOIN social_pad_members spm ON sp.id = spm.social_pad_id AND spm.user_id = $1 AND spm.accepted = true
     WHERE sp.is_public = true
        OR sp.owner_id = $1
        OR spm.user_id IS NOT NULL
     ORDER BY ss.created_at DESC`
  const queryParams: any[] = [user.id]

  const result = await db.query(query, queryParams)
  const sticks = await enrichSticksWithData(result.rows)
  return { status: 200, body: { sticks } }
}

// ============================================================================
// POST: Create stick
// ============================================================================

export async function createStick(
  input: CreateStickInput,
  user: { id: string; email?: string },
  orgContext: OrgContext
): Promise<{ status: number; body: any }> {
  const { topic, content, social_pad_id, color } = input

  if (!topic?.trim() || !social_pad_id) {
    return { status: 400, body: { error: 'Topic and pad are required' } }
  }

  // Check pad access
  const padResult = await db.query(
    `SELECT owner_id, org_id FROM social_pads WHERE id = $1`,
    [social_pad_id]
  )

  if (padResult.rows.length === 0) {
    return { status: 404, body: { error: 'Pad not found' } }
  }

  const pad = padResult.rows[0]

  // Check membership if not owner
  if (pad.owner_id !== user.id) {
    const memberResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
      [social_pad_id, user.id, orgContext.orgId]
    )

    if (memberResult.rows.length === 0) {
      return { status: 403, body: { error: "You don't have access to this pad" } }
    }
  }

  // Create stick
  const result = await db.query(
    `INSERT INTO social_sticks (topic, content, social_pad_id, user_id, org_id, color)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [topic.trim(), content?.trim() || '', social_pad_id, user.id, pad.org_id || orgContext.orgId, color || DEFAULT_STICK_COLOR]
  )

  const stick = result.rows[0]

  // Broadcast real-time events to org
  const stickOrgId = pad.org_id || orgContext.orgId
  publishToOrg(stickOrgId, {
    type: 'social_activity.new',
    payload: { stickId: stick?.id, userId: user.id, activityType: 'created' },
    timestamp: Date.now(),
  })
  publishToOrg(stickOrgId, {
    type: 'inference_notification.new',
    payload: { stickId: stick?.id, userId: user.id, type: 'stick_created' },
    timestamp: Date.now(),
  })

  return { status: 200, body: { stick } }
}
