// v2 Sticks Members API: production-quality, manage stick members
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { buildInviteLink, sendInvitationEmail } from '@/lib/handlers/stick-members-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/sticks/[id]/members - Get members
export async function GET(
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

    const membersResult = await db.query(
      `SELECT m.*, u.id as uid, u.email, u.username, u.full_name, u.avatar_url
       FROM paks_pad_stick_members m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.stick_id = $1`,
      [stickId]
    )

    const members = membersResult.rows.map((m: any) => ({
      ...m,
      users: {
        id: m.uid,
        email: m.email,
        username: m.username,
        full_name: m.full_name,
        avatar_url: m.avatar_url,
      },
    }))

    return new Response(JSON.stringify({ members }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/sticks/[id]/members - Add member
export async function POST(
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

    const body = await request.json()
    const { email, role = 'viewer' } = body

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 })
    }

    // Check stick ownership
    const stickResult = await db.query(
      `SELECT s.user_id, s.pad_id, s.topic, p.title as pad_title
       FROM paks_pad_sticks s
       LEFT JOIN paks_pads p ON s.pad_id = p.id
       WHERE s.id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0 || stickResult.rows[0].user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 })
    }

    const stick = stickResult.rows[0]

    // Find target user
    const targetResult = await db.query(
      `SELECT id, email, username FROM users WHERE email = $1`,
      [email]
    )

    if (targetResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    }

    const invitedUser = targetResult.rows[0]

    // Check if already member
    const existingResult = await db.query(
      `SELECT id FROM paks_pad_stick_members WHERE stick_id = $1 AND user_id = $2`,
      [stickId, invitedUser.id]
    )

    if (existingResult.rows.length > 0) {
      return new Response(JSON.stringify({ error: 'User is already a member' }), { status: 400 })
    }

    // Add member
    await db.query(
      `INSERT INTO paks_pad_stick_members (stick_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)`,
      [stickId, invitedUser.id, role, user.id]
    )

    // Send invitation email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const inviteLink = buildInviteLink(siteUrl, stick.pad_id, stickId)

    await sendInvitationEmail(
      siteUrl,
      email,
      stick.topic,
      stick.pad_title || 'Untitled Pad',
      role,
      inviteLink,
    )

    return new Response(
      JSON.stringify({ success: true, message: 'Member added successfully', inviteLink }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/sticks/[id]/members - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 })
    }

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

    // Check ownership
    const stickResult = await db.query(
      `SELECT user_id FROM paks_pad_sticks WHERE id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0 || stickResult.rows[0].user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 })
    }

    await db.query(
      `DELETE FROM paks_pad_stick_members WHERE stick_id = $1 AND user_id = $2`,
      [stickId, userId]
    )

    return new Response(JSON.stringify({ success: true, message: 'Member removed successfully' }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
