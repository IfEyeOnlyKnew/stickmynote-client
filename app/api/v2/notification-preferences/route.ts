// v2 Notification Preferences API: production-quality, manage notification preferences
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const DEFAULT_PREFERENCES = {
  email_enabled: true,
  push_enabled: false,
  in_app_enabled: true,
  digest_frequency: 'instant',
  digest_time: '09:00:00',
  digest_day_of_week: 1,
  stick_created_enabled: true,
  stick_updated_enabled: true,
  stick_replied_enabled: true,
  reaction_enabled: true,
  member_added_enabled: true,
  pad_invite_enabled: true,
  pad_preferences: {},
  muted_users: [],
}

// GET /api/v2/notification-preferences - Get user's notification preferences
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

    const result = await db.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [user.id]
    )

    if (result.rows.length === 0) {
      // Create default preferences
      const insertResult = await db.query(
        `INSERT INTO notification_preferences (user_id)
         VALUES ($1)
         RETURNING *`,
        [user.id]
      )
      return new Response(JSON.stringify({ preferences: insertResult.rows[0] }), { status: 200 })
    }

    return new Response(JSON.stringify({ preferences: result.rows[0] }), { status: 200 })
  } catch (error: any) {
    // Table doesn't exist - return default preferences
    if (error?.code === '42P01') {
      return new Response(
        JSON.stringify({
          preferences: {
            user_id: (await getCachedAuthUser()).user?.id,
            ...DEFAULT_PREFERENCES,
          },
        }),
        { status: 200 }
      )
    }
    return handleApiError(error)
  }
}

// PUT /api/v2/notification-preferences - Update notification preferences
export async function PUT(request: NextRequest) {
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

    const body = await request.json()

    // Remove fields that shouldn't be updated
    const { id, user_id, created_at, ...updateData } = body

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const allowedFields = [
      'email_enabled', 'push_enabled', 'in_app_enabled',
      'digest_frequency', 'digest_time', 'digest_day_of_week',
      'stick_created_enabled', 'stick_updated_enabled', 'stick_replied_enabled',
      'reaction_enabled', 'member_added_enabled', 'pad_invite_enabled',
      'pad_preferences', 'muted_users'
    ]

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        const value = ['pad_preferences', 'muted_users'].includes(field)
          ? JSON.stringify(updateData[field])
          : updateData[field]
        updates.push(`${field} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(user.id)

    const result = await db.query(
      `UPDATE notification_preferences
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    )

    return new Response(JSON.stringify({ preferences: result.rows[0] }), { status: 200 })
  } catch (error: any) {
    // Table doesn't exist - return the request body with warning
    if (error?.code === '42P01') {
      const body = await (async () => {
        try {
          return await request.json()
        } catch {
          return {}
        }
      })()
      return new Response(
        JSON.stringify({
          preferences: body,
          warning: 'Preferences feature not yet initialized',
        }),
        { status: 200 }
      )
    }
    return handleApiError(error)
  }
}
