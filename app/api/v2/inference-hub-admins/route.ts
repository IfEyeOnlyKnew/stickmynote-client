// v2 Inference Hub Admins API: production-quality, manage hub admins
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['chrisdoran63@outlook.com']

// GET /api/v2/inference-hub-admins - Get hub admins (admin only)
export async function GET(request: NextRequest) {
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

    const isAdmin = ADMIN_EMAILS.includes(user.email || '')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    return new Response(
      JSON.stringify({
        admins: [],
        currentUserRole: 'global_admin',
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-hub-admins - Assign admin role
export async function POST(request: NextRequest) {
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

    const isAdmin = ADMIN_EMAILS.includes(user.email || '')
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only global admins can assign roles' }),
        { status: 403 }
      )
    }

    const { userId, role } = await request.json()

    const result = await db.query(
      `INSERT INTO social_hub_admins (user_id, role, granted_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, role, user.id]
    )

    return new Response(JSON.stringify({ admin: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-hub-admins - Remove admin role
export async function DELETE(request: NextRequest) {
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

    const isAdmin = ADMIN_EMAILS.includes(user.email || '')
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only global admins can remove roles' }),
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('id')

    if (!adminId) {
      return new Response(JSON.stringify({ error: 'Admin ID required' }), { status: 400 })
    }

    await db.query(`DELETE FROM social_hub_admins WHERE id = $1`, [adminId])

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
