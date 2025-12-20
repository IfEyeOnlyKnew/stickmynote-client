// v2 Automation Rules API: production-quality, manage automation rules
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/automation/rules - Get user's automation rules
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const result = await db.query(
      `SELECT * FROM automation_rules
       WHERE user_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [user.id, orgContext.orgId]
    )

    return new Response(JSON.stringify({ rules: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/automation/rules - Create automation rule
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const body = await request.json()
    const { name, trigger_type, trigger_config, action_type, action_config, is_active = true } = body

    if (!name || !trigger_type || !action_type) {
      return new Response(JSON.stringify({ error: 'name, trigger_type, and action_type are required' }), { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO automation_rules (user_id, org_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        user.id,
        orgContext.orgId,
        name,
        trigger_type,
        JSON.stringify(trigger_config || {}),
        action_type,
        JSON.stringify(action_config || {}),
        is_active,
      ]
    )

    return new Response(JSON.stringify({ rule: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
