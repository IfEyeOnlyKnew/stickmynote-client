// v2 Calsticks Intake Forms API: production-quality, manage intake forms
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/intake-forms - Get user's intake forms
export async function GET() {
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
      `SELECT * FROM intake_forms
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    )

    return new Response(JSON.stringify({ forms: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/intake-forms - Create new intake form
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

    const body = await request.json()
    const { title, description, padId } = body

    // Get user's first pad if not specified
    let targetPadId = padId
    if (!targetPadId) {
      const padsResult = await db.query(
        `SELECT id FROM paks_pads WHERE owner_id = $1 LIMIT 1`,
        [user.id]
      )
      if (padsResult.rows.length > 0) {
        targetPadId = padsResult.rows[0].id
      }
    }

    const result = await db.query(
      `INSERT INTO intake_forms (owner_id, pad_id, title, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.id, targetPadId, title, description]
    )

    return new Response(JSON.stringify({ form: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
