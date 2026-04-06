// Calsticks objectives handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'

export interface ObjectivesUser {
  id: string
}

export interface ObjectivesOrgContext {
  orgId: string
}

// ============================================================================
// GET: Get user's objectives with key results
// ============================================================================

export async function getObjectives(user: ObjectivesUser, orgContext: ObjectivesOrgContext) {
  const result = await db.query(
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
    [user.id, orgContext.orgId],
  )

  return result.rows
}

// ============================================================================
// POST: Create new objective with key results
// ============================================================================

export interface CreateObjectiveInput {
  title: string
  description?: string
  status?: string
  start_date?: string
  end_date?: string
  key_results?: {
    title: string
    start_value: number
    current_value: number
    target_value: number
  }[]
}

export async function createObjective(
  user: ObjectivesUser,
  orgContext: ObjectivesOrgContext,
  input: CreateObjectiveInput,
) {
  const { key_results, title, description, status, start_date, end_date } = input

  // Create objective
  const objectiveResult = await db.query(
    `INSERT INTO objectives (user_id, org_id, title, description, status, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [user.id, orgContext.orgId, title, description, status || 'active', start_date, end_date],
  )

  const objective = objectiveResult.rows[0]

  // Create key results if provided
  if (key_results && key_results.length > 0) {
    for (const kr of key_results) {
      const progress = Math.round(
        ((kr.current_value - kr.start_value) / (kr.target_value - kr.start_value)) * 100,
      )

      await db.query(
        `INSERT INTO key_results (objective_id, org_id, title, start_value, current_value, target_value, progress)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          objective.id,
          orgContext.orgId,
          kr.title,
          kr.start_value,
          kr.current_value,
          kr.target_value,
          progress,
        ],
      )
    }
  }

  return objective
}
