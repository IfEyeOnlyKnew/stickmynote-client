// v2 Calsticks Objectives [id] API: production-quality, manage individual objective
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// PUT /api/v2/calsticks/objectives/[id] - Update objective
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
    const { key_results, title, description, status, start_date, end_date } = body

    // Update objective
    const objectiveResult = await db.query(
      `UPDATE objectives
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           start_date = COALESCE($4, start_date),
           end_date = COALESCE($5, end_date),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [title, description, status, start_date, end_date, id, user.id]
    )

    if (objectiveResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Objective not found' }), { status: 404 })
    }

    const objective = objectiveResult.rows[0]

    // Delete existing key results and recreate if provided
    if (key_results !== undefined) {
      await db.query(`DELETE FROM key_results WHERE objective_id = $1`, [id])

      if (key_results && key_results.length > 0) {
        for (const kr of key_results) {
          const progress = Math.round(
            ((kr.current_value - kr.start_value) / (kr.target_value - kr.start_value)) * 100
          )

          await db.query(
            `INSERT INTO key_results (objective_id, title, start_value, current_value, target_value, progress)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, kr.title, kr.start_value, kr.current_value, kr.target_value, progress]
          )
        }
      }
    }

    return new Response(JSON.stringify(objective), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/calsticks/objectives/[id] - Delete objective
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Delete objective (key_results should cascade delete)
    const result = await db.query(
      `DELETE FROM objectives WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Objective not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
