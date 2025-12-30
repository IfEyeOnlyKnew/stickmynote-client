// v2 Calsticks Attachments API: production-quality, manage calstick attachments
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/[id]/attachments - Get attachments for a calstick
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
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
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    // Verify ownership
    const calstickResult = await db.query(
      `SELECT user_id, org_id FROM calsticks WHERE id = $1 AND org_id = $2`,
      [id, orgContext.orgId]
    )

    const calstick = calstickResult.rows[0]
    if (!calstick || calstick.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const attachmentsResult = await db.query(
      `SELECT * FROM calstick_attachments WHERE calstick_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [id, orgContext.orgId]
    )

    return new Response(JSON.stringify({ attachments: attachmentsResult.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/[id]/attachments - Add attachment to a calstick
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
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
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    // Verify ownership
    const calstickResult = await db.query(
      `SELECT user_id, org_id FROM calsticks WHERE id = $1 AND org_id = $2`,
      [id, orgContext.orgId]
    )

    const calstick = calstickResult.rows[0]
    if (!calstick || calstick.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const body = await request.json()
    const { name, url, size, type, provider = 'local', provider_id, thumbnail_url } = body

    const insertResult = await db.query(
      `INSERT INTO calstick_attachments (calstick_id, org_id, name, url, size, type, provider, provider_id, thumbnail_url, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, orgContext.orgId, name, url, size, type, provider, provider_id, thumbnail_url, user.id]
    )

    return new Response(JSON.stringify({ attachment: insertResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/calsticks/[id]/attachments - Delete attachment from a calstick
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
  try {
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
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return new Response(JSON.stringify({ error: 'Attachment ID required' }), { status: 400 })
    }

    await db.query(
      `DELETE FROM calstick_attachments WHERE id = $1 AND org_id = $2 AND uploaded_by = $3`,
      [attachmentId, orgContext.orgId, user.id]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
