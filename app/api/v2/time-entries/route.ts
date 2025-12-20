// v2 Time Entries API: production-quality, manage time entries
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/time-entries - Get user's time entries
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

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const taskId = searchParams.get('taskId')

    let query = `
      SELECT
        te.*,
        r.id as task_id, r.content as task_content,
        s.id as stick_id, s.topic as stick_topic, s.content as stick_content
      FROM paks_time_entries te
      LEFT JOIN paks_pad_stick_replies r ON r.id = te.task_id
      LEFT JOIN paks_pad_sticks s ON s.id = r.stick_id
      WHERE te.user_id = $1`

    const params: any[] = [user.id]
    let paramIndex = 2

    if (start) {
      query += ` AND te.started_at >= $${paramIndex}`
      params.push(start)
      paramIndex++
    }

    if (end) {
      query += ` AND te.started_at <= $${paramIndex}`
      params.push(end)
      paramIndex++
    }

    if (taskId) {
      query += ` AND te.task_id = $${paramIndex}`
      params.push(taskId)
      paramIndex++
    }

    query += ` ORDER BY te.started_at DESC`

    const result = await db.query(query, params)

    // Format entries with nested task object
    const entries = result.rows.map((row: any) => ({
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_seconds: row.duration_seconds,
      note: row.note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      task: row.task_id ? {
        id: row.task_id,
        content: row.task_content,
        stick: row.stick_id ? {
          id: row.stick_id,
          topic: row.stick_topic,
          content: row.stick_content,
        } : null,
      } : null,
    }))

    return new Response(JSON.stringify({ entries }), { status: 200 })
  } catch (error: any) {
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return new Response(
        JSON.stringify({
          entries: [],
          tableNotFound: true,
          message: 'Time tracking tables not created. Please run scripts/add-calstick-phase2-fields.sql',
        }),
        { status: 200 }
      )
    }
    return handleApiError(error)
  }
}

// POST /api/v2/time-entries - Create a time entry
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

    const { taskId, startedAt, endedAt, durationSeconds, note } = await request.json()

    if (!taskId || !startedAt) {
      return new Response(
        JSON.stringify({ error: 'Task ID and start time are required' }),
        { status: 400 }
      )
    }

    // Verify task exists
    const taskResult = await db.query(
      `SELECT id FROM paks_pad_stick_replies WHERE id = $1`,
      [taskId]
    )

    if (taskResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 })
    }

    const result = await db.query(
      `INSERT INTO paks_time_entries (task_id, user_id, started_at, ended_at, duration_seconds, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [taskId, user.id, startedAt, endedAt, durationSeconds, note]
    )

    return new Response(JSON.stringify({ entry: result.rows[0] }), { status: 200 })
  } catch (error: any) {
    if (error?.code === '42P01') {
      return new Response(
        JSON.stringify({
          error: 'Time tracking tables not created',
          tableNotFound: true,
        }),
        { status: 500 }
      )
    }
    return handleApiError(error)
  }
}
