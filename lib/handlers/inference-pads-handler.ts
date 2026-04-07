// Inference Pads handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'
import type { OrgContext } from '@/lib/auth/get-org-context'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'

// ============================================================================
// Constants
// ============================================================================

const ADMIN_EMAILS = new Set(['chrisdoran63@outlook.com'])

// ============================================================================
// Types
// ============================================================================

export interface ListPadsParams {
  isPublic: boolean
  isAdmin: boolean
  isPrivate: boolean
}

export interface CreatePadInput {
  name: string
  description?: string
  is_public?: boolean
  category_id?: string
  hub_type?: string
  hub_email?: string
  access_mode?: string
  home_code?: string
}

// ============================================================================
// GET: List pads
// ============================================================================

export async function listPads(
  params: ListPadsParams,
  user: { id: string; email?: string } | null,
  orgContext: OrgContext | null
): Promise<{ status: number; body: any }> {
  const { isPublic, isAdmin, isPrivate } = params

  // Public pads - no auth required
  if (isPublic) {
    const result = await db.query(
      `SELECT * FROM social_pads WHERE is_public = true ORDER BY created_at DESC`
    )
    return { status: 200, body: { pads: result.rows } }
  }

  // All other queries require auth
  if (!user) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  // Admin view - only for admin users
  if (isAdmin) {
    const isUserAdmin = user.email && ADMIN_EMAILS.has(user.email)
    if (!isUserAdmin) {
      return { status: 403, body: { error: 'Forbidden' } }
    }

    const result = await db.query(`SELECT * FROM social_pads ORDER BY created_at DESC`)
    return { status: 200, body: { pads: result.rows } }
  }

  if (!orgContext) {
    return { status: 403, body: { error: 'No organization context' } }
  }

  // Private pads only
  if (isPrivate) {
    const ownedResult = await db.query(
      `SELECT * FROM social_pads
       WHERE owner_id = $1 AND org_id = $2 AND is_public = false
       ORDER BY created_at DESC`,
      [user.id, orgContext.orgId]
    )

    const memberResult = await db.query(
      `SELECT sp.* FROM social_pads sp
       INNER JOIN social_pad_members spm ON sp.id = spm.social_pad_id
       WHERE spm.user_id = $1 AND spm.accepted = true
         AND sp.org_id = $2 AND sp.is_public = false
         AND sp.owner_id != $1
       ORDER BY sp.created_at DESC`,
      [user.id, orgContext.orgId]
    )

    const allPrivatePads = [...ownedResult.rows, ...memberResult.rows]
    return { status: 200, body: { pads: allPrivatePads } }
  }

  // Default: all user's pads (owned + member)
  const ownedResult = await db.query(
    `SELECT * FROM social_pads
     WHERE owner_id = $1 AND org_id = $2
     ORDER BY created_at DESC`,
    [user.id, orgContext.orgId]
  )

  const memberResult = await db.query(
    `SELECT sp.* FROM social_pads sp
     INNER JOIN social_pad_members spm ON sp.id = spm.social_pad_id
     WHERE spm.user_id = $1 AND spm.accepted = true
       AND sp.org_id = $2 AND sp.owner_id != $1
     ORDER BY sp.created_at DESC`,
    [user.id, orgContext.orgId]
  )

  const allPads = [...ownedResult.rows, ...memberResult.rows]
  const uniquePads = Array.from(new Map(allPads.map((pad) => [pad.id, pad])).values())

  return { status: 200, body: { pads: uniquePads } }
}

// ============================================================================
// POST: Create pad
// ============================================================================

export async function createPad(
  input: CreatePadInput,
  user: { id: string },
  orgContext: OrgContext
): Promise<{ status: number; body: any }> {
  const { name, description, is_public, category_id, hub_type, hub_email, access_mode, home_code } = input

  if (!name?.trim()) {
    return { status: 400, body: { error: 'Pad name is required' } }
  }

  // Start transaction
  await db.query('BEGIN')

  try {
    // Insert pad
    const padResult = await db.query(
      `INSERT INTO social_pads
       (name, description, owner_id, org_id, is_public, category_id, hub_type, hub_email, access_mode, home_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        user.id,
        orgContext.orgId,
        is_public || false,
        category_id || null,
        hub_type || null,
        hub_email || null,
        access_mode || null,
        home_code?.trim() || null,
      ]
    )

    const pad = padResult.rows[0]

    if (!pad) {
      throw new Error('Failed to create pad')
    }

    // Add owner as member
    await db.query(
      `INSERT INTO social_pad_members
       (social_pad_id, user_id, org_id, role, accepted, invited_by, admin_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [pad.id, user.id, orgContext.orgId, 'editor', true, user.id, 'owner']
    )

    await db.query('COMMIT')

    return { status: 200, body: { pad } }
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  }
}

// ============================================================================
// GET: Get pad detail with sticks
// ============================================================================

export async function getPadDetail(
  padId: string,
  user: { id: string } | null,
  orgContext: OrgContext | null
): Promise<{ status: number; body: any }> {
  // Get pad with member count
  let padQuery = `SELECT sp.*,
                  (SELECT COUNT(*) FROM social_pad_members WHERE social_pad_id = sp.id) as member_count
                  FROM social_pads sp WHERE sp.id = $1`
  const padParams: any[] = [padId]

  if (orgContext) {
    padQuery += ` AND sp.org_id = $2`
    padParams.push(orgContext.orgId)
  }

  const padResult = await db.query(padQuery, padParams)
  const pad = padResult.rows[0]

  if (!pad) {
    return { status: 404, body: { error: 'Pad not found' } }
  }

  // Get owner info
  const ownerResult = await db.query(
    `SELECT email, full_name FROM users WHERE id = $1`,
    [pad.owner_id]
  )
  const owner = ownerResult.rows[0] || null

  // Check access for private pads
  if (!pad.is_public) {
    if (!user) {
      return { status: 401, body: { error: 'Unauthorized' } }
    }

    const memberResult = await db.query(
      `SELECT * FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true`,
      [padId, user.id]
    )

    if (pad.owner_id !== user.id && memberResult.rows.length === 0) {
      return { status: 403, body: { error: 'Forbidden' } }
    }
  }

  // Get sticks with reply counts
  let sticksQuery = `SELECT ss.*,
                     (SELECT COUNT(*) FROM social_stick_replies WHERE social_stick_id = ss.id) as reply_count
                     FROM social_sticks ss WHERE ss.social_pad_id = $1`
  const sticksParams: any[] = [padId]

  if (orgContext) {
    sticksQuery += ` AND ss.org_id = $2`
    sticksParams.push(orgContext.orgId)
  }

  sticksQuery += ` ORDER BY ss.created_at DESC`

  const sticksResult = await db.query(sticksQuery, sticksParams)

  // Get user info for each stick
  const sticksWithUsers = await Promise.all(
    sticksResult.rows.map(async (stick: any) => {
      const userResult = await db.query(
        `SELECT email, full_name FROM users WHERE id = $1`,
        [stick.user_id]
      )
      return {
        ...stick,
        user: userResult.rows[0] || null,
      }
    })
  )

  return {
    status: 200,
    body: {
      pad: { ...pad, owner, member_count: Number(pad.member_count) || 0 },
      sticks: sticksWithUsers,
    },
  }
}

// ============================================================================
// PATCH: Update pad
// ============================================================================

export async function updatePadDetail(
  padId: string,
  updates: { name?: string; description?: string; is_public?: boolean },
  user: { id: string },
  orgContext: OrgContext
): Promise<{ status: number; body: any }> {
  // Check ownership
  const padResult = await db.query(
    `SELECT owner_id FROM social_pads WHERE id = $1 AND org_id = $2`,
    [padId, orgContext.orgId]
  )

  if (padResult.rows.length === 0 || padResult.rows[0].owner_id !== user.id) {
    return { status: 403, body: { error: 'Unauthorized' } }
  }

  const updateResult = await db.query(
    `UPDATE social_pads
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         is_public = COALESCE($3, is_public),
         updated_at = NOW()
     WHERE id = $4 AND org_id = $5
     RETURNING *`,
    [updates.name, updates.description, updates.is_public, padId, orgContext.orgId]
  )

  return { status: 200, body: { pad: updateResult.rows[0] } }
}

// ============================================================================
// DELETE: Delete pad
// ============================================================================

export async function deletePadDetail(
  padId: string,
  user: { id: string },
  orgContext: OrgContext
): Promise<{ status: number; body: any }> {
  // Check ownership
  const padResult = await db.query(
    `SELECT owner_id FROM social_pads WHERE id = $1 AND org_id = $2`,
    [padId, orgContext.orgId]
  )

  if (padResult.rows.length === 0 || padResult.rows[0].owner_id !== user.id) {
    return { status: 403, body: { error: 'Unauthorized' } }
  }

  if (await isUnderLegalHold(user.id, orgContext.orgId)) {
    return { status: 403, body: { error: 'Content cannot be deleted: active legal hold' } }
  }

  // Delete pad (cascade should handle members, sticks, etc.)
  await db.query(`DELETE FROM social_pads WHERE id = $1`, [padId])

  return { status: 200, body: { success: true } }
}
