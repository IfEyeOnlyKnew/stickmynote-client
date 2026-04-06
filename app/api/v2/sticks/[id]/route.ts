// v2 Sticks [id] API: production-quality, update and delete sticks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'
import { buildPatchUpdateData, canEditStick, canDeleteStick } from '@/lib/handlers/stick-detail-handler'

export const dynamic = 'force-dynamic'

async function checkEditPermission(stickId: string, userId: string, orgId: string) {
  const stickResult = await db.query(
    `SELECT s.user_id, s.pad_id, p.owner_id as pad_owner_id
     FROM paks_pad_sticks s
     LEFT JOIN paks_pads p ON s.pad_id = p.id
     WHERE s.id = $1 AND s.org_id = $2`,
    [stickId, orgId]
  )

  if (stickResult.rows.length === 0) {
    return { hasPermission: false, notFound: true }
  }

  const stick = stickResult.rows[0]

  // Check membership
  const memberResult = await db.query(
    `SELECT role FROM paks_pad_members
     WHERE pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [stick.pad_id, userId, orgId]
  )

  const hasPermission = canEditStick(stick.user_id, stick.pad_owner_id, memberResult.rows[0]?.role, userId)

  return { hasPermission, stick }
}

// PUT /api/v2/sticks/[id] - Full update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const { hasPermission, notFound } = await checkEditPermission(stickId, user.id, orgContext.orgId)

    if (notFound) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    const body = await request.json()
    const { topic, content, details, color } = body

    const updateResult = await db.query(
      `UPDATE paks_pad_sticks
       SET topic = $1, content = $2, details = $3, color = $4, updated_at = NOW()
       WHERE id = $5 AND org_id = $6
       RETURNING *`,
      [topic, content, details, color, stickId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ stick: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/sticks/[id] - Partial update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const { hasPermission, notFound } = await checkEditPermission(stickId, user.id, orgContext.orgId)

    if (notFound) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    const body = await request.json()
    const patchData = buildPatchUpdateData(body)

    // Build dynamic update from patchData (excluding updated_at which is handled by NOW())
    const updates: string[] = ['updated_at = NOW()']
    const values: any[] = []
    let paramCount = 0

    for (const [key, value] of Object.entries(patchData)) {
      if (key === 'updated_at') continue
      paramCount++
      updates.push(`${key} = $${paramCount}`)
      values.push(value)
    }

    paramCount++
    values.push(stickId)
    paramCount++
    values.push(orgContext.orgId)

    const updateResult = await db.query(
      `UPDATE paks_pad_sticks
       SET ${updates.join(', ')}
       WHERE id = $${paramCount - 1} AND org_id = $${paramCount}
       RETURNING *`,
      values
    )

    return new Response(JSON.stringify({ stick: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/sticks/[id] - Delete stick
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    // Get stick
    const stickResult = await db.query(
      `SELECT s.user_id, s.pad_id, p.owner_id as pad_owner_id
       FROM paks_pad_sticks s
       LEFT JOIN paks_pads p ON s.pad_id = p.id
       WHERE s.id = $1 AND s.org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Check delete permission
    let memberRole: string | undefined
    if (stick.user_id !== user.id && stick.pad_owner_id !== user.id) {
      const memberResult = await db.query(
        `SELECT role FROM paks_pad_members
         WHERE pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
        [stick.pad_id, user.id, orgContext.orgId]
      )
      memberRole = memberResult.rows[0]?.role
    }

    if (!canDeleteStick(stick.user_id, stick.pad_owner_id, memberRole, user.id)) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    if (await isUnderLegalHold(user.id, orgContext.orgId)) {
      return new Response(JSON.stringify({ error: 'Content cannot be deleted: active legal hold' }), { status: 403 })
    }

    await db.query(
      `DELETE FROM paks_pad_sticks WHERE id = $1 AND org_id = $2`,
      [stickId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ message: 'Stick deleted successfully' }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
