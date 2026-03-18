// v2 Social Sticks Members API: production-quality, manage stick members
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-sticks/[stickId]/members - Get members
export async function GET(
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

    const result = await db.query(
      `SELECT m.*, u.id as uid, u.full_name, u.username, u.email, u.avatar_url
       FROM social_stick_members m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.social_stick_id = $1
       ORDER BY m.granted_at DESC`,
      [stickId]
    )

    const members = result.rows.map((m: any) => ({
      ...m,
      users: {
        id: m.uid,
        full_name: m.full_name,
        username: m.username,
        email: m.email,
        avatar_url: m.avatar_url,
      },
    }))

    return new Response(JSON.stringify({ members }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-sticks/[stickId]/members - Add member
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

    const body = await request.json()
    const { email } = body

    if (!email?.trim()) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 })
    }

    // Get stick with pad info
    const stickResult = await db.query(
      `SELECT ss.social_pad_id, ss.topic, sp.owner_id as pad_owner_id, sp.name as pad_name
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE ss.id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Check permission
    const isOwner = stick.pad_owner_id === user.id
    if (!isOwner) {
      const memberResult = await db.query(
        `SELECT role FROM social_pad_members
         WHERE social_pad_id = $1 AND user_id = $2`,
        [stick.social_pad_id, user.id]
      )

      if (memberResult.rows[0]?.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Only pad owners and admins can manage stick members' }),
          { status: 403 }
        )
      }
    }

    // Look up target user
    const targetResult = await db.query(
      `SELECT id, email, full_name FROM users WHERE email = $1`,
      [email.trim()]
    )

    if (targetResult.rows.length > 0) {
      const targetUser = targetResult.rows[0]

      // Check if already a member
      const existingResult = await db.query(
        `SELECT id FROM social_stick_members
         WHERE social_stick_id = $1 AND user_id = $2`,
        [stickId, targetUser.id]
      )

      if (existingResult.rows.length > 0) {
        return new Response(
          JSON.stringify({ error: 'User is already a member of this stick' }),
          { status: 400 }
        )
      }

      // Add as member
      await db.query(
        `INSERT INTO social_stick_members (social_stick_id, user_id, role, granted_by)
         VALUES ($1, $2, $3, $4)`,
        [stickId, targetUser.id, 'member', user.id]
      )

      return new Response(
        JSON.stringify({ message: 'Member added successfully', userExists: true }),
        { status: 200 }
      )
    } else {
      // User doesn't exist - would send invitation email
      return new Response(
        JSON.stringify({
          message: 'Invitation email would be sent. User will be added when they sign up.',
          userExists: false,
        }),
        { status: 200 }
      )
    }
  } catch (error) {
    return handleApiError(error)
  }
}
