// Calsticks CSV Export handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Fetch calstick tasks for a user with related stick/pad data, then format as CSV.
 */
export async function exportCalsticksCsv(userId: string): Promise<string> {
  // Fetch all CalSticks for the user with related data via JOIN
  const result = await db.query(
    `SELECT
      r.id,
      r.content,
      r.calstick_date,
      r.calstick_start_date,
      r.calstick_status,
      r.calstick_priority,
      r.calstick_completed,
      r.calstick_completed_at,
      r.calstick_estimated_hours,
      r.calstick_actual_hours,
      r.calstick_labels,
      r.created_at,
      r.updated_at,
      s.topic as stick_topic,
      p.name as pad_name
     FROM paks_pad_stick_replies r
     LEFT JOIN paks_pad_sticks s ON r.stick_id = s.id
     LEFT JOIN paks_pads p ON s.pad_id = p.id
     WHERE r.is_calstick = true
       AND (r.user_id = $1 OR r.calstick_assignee_id = $1)
     ORDER BY r.calstick_date DESC NULLS LAST`,
    [userId]
  )

  const tasks = result.rows

  // Generate CSV content
  const headers = [
    'Task ID',
    'Topic',
    'Content',
    'Project/Pad',
    'Status',
    'Priority',
    'Due Date',
    'Start Date',
    'Completed',
    'Completed At',
    'Est. Hours',
    'Actual Hours',
    'Labels',
  ]

  const csvRows = [headers.join(',')]

  tasks.forEach((task: any) => {
    const row = [
      task.id,
      `"${(task.stick_topic || '').replaceAll('"', '""')}"`,
      `"${(task.content || '').replaceAll('"', '""')}"`,
      `"${(task.pad_name || '').replaceAll('"', '""')}"`,
      task.calstick_status || 'todo',
      task.calstick_priority || 'none',
      task.calstick_date ? new Date(task.calstick_date).toLocaleDateString() : '',
      task.calstick_start_date ? new Date(task.calstick_start_date).toLocaleDateString() : '',
      task.calstick_completed ? 'Yes' : 'No',
      task.calstick_completed_at ? new Date(task.calstick_completed_at).toLocaleString() : '',
      task.calstick_estimated_hours || '0',
      task.calstick_actual_hours || '0',
      `"${(task.calstick_labels || []).join('; ')}"`,
    ]
    csvRows.push(row.join(','))
  })

  return csvRows.join('\n')
}
