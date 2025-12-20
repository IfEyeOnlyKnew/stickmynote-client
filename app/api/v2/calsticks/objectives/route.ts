// v2 Calsticks Objectives API: production-quality, manage OKRs
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/objectives - Get user's objectives
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    // Get objectives with key results
    const objectivesResult = await db.query(
      `SELECT o.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', kr.id,
                    'title', kr.title,
                    'start_value', kr.start_value,
                    'current_value', kr.current_value,
                    'target_value', kr.target_value,
                    'progress', kr.progress
                  )
                ) FILTER (WHERE kr.id IS NOT NULL), '[]'
              ) as key_results
       FROM objectives o
       LEFT JOIN key_results kr ON o.id = kr.objective_id
       WHERE o.user_id = $1 AND o.org_id = $2
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [user.id, orgContext.orgId]
    )

    return new Response(JSON.stringify(objectivesResult.rows), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/objectives - Create new objective
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
    const { key_results, title, description, status, start_date, end_date } = body

    // Create objective
    const objectiveResult = await db.query(
      `INSERT INTO objectives (user_id, org_id, title, description, status, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user.id, orgContext.orgId, title, description, status || 'active', start_date, end_date]
    )

    const objective = objectiveResult.rows[0]

    // Create key results if provided
    if (key_results && key_results.length > 0) {
      for (const kr of key_results) {
        const progress = Math.round(
          ((kr.current_value - kr.start_value) / (kr.target_value - kr.start_value)) * 100
        )

        await db.query(
          `INSERT INTO key_results (objective_id, org_id, title, start_value, current_value, target_value, progress)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [objective.id, orgContext.orgId, kr.title, kr.start_value, kr.current_value, kr.target_value, progress]
        )
      }
    }

    return new Response(JSON.stringify(objective), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
