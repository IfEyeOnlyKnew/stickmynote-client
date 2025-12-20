// v2 Calsticks Custom Field Values API: production-quality, manage field values
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/custom-fields/values - Get field values for a task
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'Missing taskId' }), { status: 400 })
    }

    const result = await db.query(
      `SELECT v.*, d.* as definition
       FROM custom_field_values v
       LEFT JOIN custom_field_definitions d ON v.field_id = d.id
       WHERE v.task_id = $1`,
      [taskId]
    )

    return new Response(JSON.stringify({ values: result.rows }), { status: 200 })
  } catch (error: any) {
    if (error.code === '42P01') {
      // Table doesn't exist
      return new Response(
        JSON.stringify({
          values: [],
          tableNotFound: true,
          message: 'Custom fields table not created yet. Run scripts/add-calstick-custom-fields.sql',
        }),
        { status: 200 }
      )
    }
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/custom-fields/values - Set field value
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const body = await request.json()
    const { taskId, fieldId, value, type } = body

    let valueText = null
    let valueNumber = null
    let valueDate = null
    let valueBoolean = null

    if (type === 'number') {
      valueNumber = value
    } else if (type === 'date') {
      valueDate = value
    } else if (type === 'boolean') {
      valueBoolean = value
    } else {
      valueText = value
    }

    const result = await db.query(
      `INSERT INTO custom_field_values (task_id, field_id, value_text, value_number, value_date, value_boolean)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (task_id, field_id) DO UPDATE SET
         value_text = EXCLUDED.value_text,
         value_number = EXCLUDED.value_number,
         value_date = EXCLUDED.value_date,
         value_boolean = EXCLUDED.value_boolean
       RETURNING *`,
      [taskId, fieldId, valueText, valueNumber, valueDate, valueBoolean]
    )

    return new Response(JSON.stringify({ value: result.rows[0] }), { status: 200 })
  } catch (error: any) {
    if (error.code === '42P01') {
      return new Response(
        JSON.stringify({ error: 'Custom fields table not created yet', tableNotFound: true }),
        { status: 400 }
      )
    }
    return handleApiError(error)
  }
}
