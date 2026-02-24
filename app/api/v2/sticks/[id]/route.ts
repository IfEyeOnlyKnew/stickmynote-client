// v2 Sticks [id] API: production-quality, update and delete sticks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'

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

  // Check ownership
  if (stick.user_id === userId || stick.pad_owner_id === userId) {
    return { hasPermission: true, stick }
  }

  // Check membership
  const memberResult = await db.query(
    `SELECT role FROM paks_pad_members
     WHERE pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [stick.pad_id, userId, orgId]
  )

  const canEdit =
    memberResult.rows[0]?.role === 'admin' || memberResult.rows[0]?.role === 'edit'

  return { hasPermission: canEdit, stick }
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

    // Build dynamic update
    const updates: string[] = ['updated_at = NOW()']
    const values: any[] = []
    let paramCount = 0

    if (body.topic !== undefined) {
      paramCount++
      updates.push(`topic = $${paramCount}`)
      values.push(body.topic)
    }
    if (body.content !== undefined) {
      paramCount++
      updates.push(`content = $${paramCount}`)
      values.push(body.content)
    }
    if (body.details !== undefined) {
      paramCount++
      updates.push(`details = $${paramCount}`)
      values.push(body.details)
    }
    if (body.color !== undefined) {
      paramCount++
      updates.push(`color = $${paramCount}`)
      values.push(body.color)
    }
    if (body.is_quickstick !== undefined) {
      paramCount++
      updates.push(`is_quickstick = $${paramCount}`)
      values.push(body.is_quickstick)
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
    const isStickOwner = stick.user_id === user.id
    const isPadOwner = stick.pad_owner_id === user.id

    if (!isStickOwner && !isPadOwner) {
      const memberResult = await db.query(
        `SELECT role FROM paks_pad_members
         WHERE pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
        [stick.pad_id, user.id, orgContext.orgId]
      )

      if (memberResult.rows[0]?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
      }
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
