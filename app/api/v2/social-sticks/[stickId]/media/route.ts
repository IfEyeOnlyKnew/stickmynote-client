// v2 Social Sticks Media API: production-quality, manage stick media
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/social-sticks/[stickId]/media - Add media
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    const body = await request.json()
    const { url, type, filename } = body

    // Check stick ownership
    const stickResult = await db.query(
      `SELECT user_id FROM social_sticks WHERE id = $1 AND org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0 || stickResult.rows[0].user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
    }

    // Insert media
    const mediaResult = await db.query(
      `INSERT INTO social_stick_media (social_stick_id, url, type, filename, user_id, org_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [stickId, url, type, filename, user.id, orgContext.orgId]
    )

    return new Response(
      JSON.stringify({ success: true, data: mediaResult.rows[0] }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-sticks/[stickId]/media - Remove media
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    const body = await request.json()
    const { url } = body

    await db.query(
      `DELETE FROM social_stick_media
       WHERE social_stick_id = $1 AND url = $2 AND user_id = $3 AND org_id = $4`,
      [stickId, url, user.id, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
