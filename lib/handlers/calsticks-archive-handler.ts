// Calsticks archive handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'

export interface ArchiveUser {
  id: string
}

const DEFAULT_AUTO_ARCHIVE_DAYS = 14
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

// ============================================================================
// POST: Archive tasks (single or bulk)
// ============================================================================

export interface ArchiveInput {
  taskIds?: string[]
  archiveAll?: boolean
}

export async function archiveTasks(user: ArchiveUser, input: ArchiveInput) {
  const { taskIds, archiveAll } = input

  if (archiveAll) {
    const userPrefsResult = await db.query(
      `SELECT calstick_auto_archive_days FROM users WHERE id = $1`,
      [user.id],
    )

    const autoArchiveDays =
      userPrefsResult.rows[0]?.calstick_auto_archive_days ?? DEFAULT_AUTO_ARCHIVE_DAYS
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - autoArchiveDays)

    const result = await db.query(
      `UPDATE calstick_tasks
       SET is_archived = true, archived_at = NOW()
       WHERE user_id = $1 AND calstick_completed = true AND is_archived = false
       AND calstick_completed_at < $2
       RETURNING id`,
      [user.id, cutoffDate.toISOString()],
    )

    return { success: true, archivedCount: result.rows.length }
  }

  if (taskIds?.length) {
    await db.query(
      `UPDATE calstick_tasks SET is_archived = true, archived_at = NOW()
       WHERE id = ANY($1) AND user_id = $2`,
      [taskIds, user.id],
    )

    return { success: true, archivedCount: taskIds.length }
  }

  throw new Error('No tasks specified')
}

// ============================================================================
// DELETE: Unarchive a task
// ============================================================================

export async function unarchiveTask(user: ArchiveUser, taskId: string) {
  if (!taskId) {
    throw new Error('Task ID required')
  }

  await db.query(
    `UPDATE calstick_tasks SET is_archived = false, archived_at = NULL
     WHERE id = $1 AND user_id = $2`,
    [taskId, user.id],
  )

  return { success: true }
}

// ============================================================================
// GET: Get archived tasks with related data
// ============================================================================

export interface GetArchivedParams {
  page?: number
  limit?: number
}

export async function getArchivedTasks(user: ArchiveUser, params: GetArchivedParams = {}) {
  const page = params.page ?? DEFAULT_PAGE
  const limit = params.limit ?? DEFAULT_LIMIT
  const offset = (page - 1) * limit

  const result = await db.query(
    `SELECT t.*,
            json_build_object('id', s.id, 'topic', s.topic, 'content', s.content,
              'pad', json_build_object('id', p.id, 'name', p.name)) as stick,
            json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email,
              'username', u.username, 'avatar_url', u.avatar_url) as user
     FROM calstick_tasks t
     LEFT JOIN sticks s ON t.stick_id = s.id
     LEFT JOIN pads p ON s.pad_id = p.id
     LEFT JOIN users u ON t.user_id = u.id
     WHERE t.user_id = $1 AND t.is_archived = true
     ORDER BY t.archived_at DESC
     LIMIT $2 OFFSET $3`,
    [user.id, limit, offset],
  )

  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM calstick_tasks WHERE user_id = $1 AND is_archived = true`,
    [user.id],
  )

  const count = Number.parseInt(countResult.rows[0]?.count || '0')

  return {
    archivedTasks: result.rows,
    total: count,
    hasMore: count > offset + limit,
  }
}
