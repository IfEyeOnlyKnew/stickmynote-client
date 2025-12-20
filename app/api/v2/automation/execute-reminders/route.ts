// v2 Automation Execute Reminders API: production-quality, cron job endpoint
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// Helper: Send notification reminder
async function sendNotificationReminder(reminder: any) {
  const task = reminder.stick_replies || {}
  await db.query(
    `INSERT INTO notifications (user_id, org_id, type, title, message, related_id, related_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      reminder.user_id,
      task.org_id,
      'tag',
      'Task Reminder',
      reminder.message || `Reminder: ${task.content || 'Task'}`,
      task.id,
      'reply',
    ]
  )
}

// Helper: Send email reminder
async function sendEmailReminder(reminder: any, siteUrl: string) {
  const task = reminder.stick_replies || {}

  const userResult = await db.query(
    `SELECT email FROM users WHERE id = $1`,
    [reminder.user_id]
  )

  if (userResult.rows.length === 0 || !userResult.rows[0].email) return

  const email = userResult.rows[0].email

  await fetch(`${siteUrl}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject: 'Task Reminder',
      html: `<div style="font-family: sans-serif; max-width: 600px;">
        <h2>Task Reminder</h2>
        <p>${reminder.message || 'You have a task reminder:'}</p>
        <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
          <p><strong>Task:</strong> ${task.content || 'N/A'}</p>
          <p><strong>Status:</strong> ${task.calstick_status || 'N/A'}</p>
          ${task.calstick_date ? `<p><strong>Due Date:</strong> ${new Date(task.calstick_date).toLocaleDateString()}</p>` : ''}
        </div>
      </div>`,
      text: `Task Reminder: ${task.content || 'Task'}`,
    }),
  })
}

// Helper: Process a single reminder
async function processReminder(reminder: any, siteUrl: string): Promise<{ id: string; status: string }> {
  try {
    if (reminder.reminder_type === 'notification') {
      await sendNotificationReminder(reminder)
    } else if (reminder.reminder_type === 'email') {
      await sendEmailReminder(reminder, siteUrl)
    }

    await db.query(
      `UPDATE task_reminders SET is_sent = true, sent_at = NOW() WHERE id = $1`,
      [reminder.id]
    )

    return { id: reminder.id, status: 'sent' }
  } catch (err) {
    console.error(`Error sending reminder ${reminder.id}:`, err)
    return { id: reminder.id, status: 'error' }
  }
}

// POST /api/v2/automation/execute-reminders - Execute pending reminders (cron job)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const now = new Date().toISOString()

    // Get pending reminders with task info
    const result = await db.query(
      `SELECT r.*, sr.id as stick_reply_id, sr.org_id, sr.content, sr.calstick_status, sr.calstick_date
       FROM task_reminders r
       LEFT JOIN paks_pad_stick_replies sr ON r.task_id = sr.id
       WHERE r.is_sent = false AND r.remind_at <= $1
       LIMIT 100`,
      [now]
    )

    const reminders = result.rows.map((row: any) => ({
      ...row,
      stick_replies: {
        id: row.stick_reply_id,
        org_id: row.org_id,
        content: row.content,
        calstick_status: row.calstick_status,
        calstick_date: row.calstick_date,
      },
    }))

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const results = await Promise.all(
      reminders.map((reminder: any) => processReminder(reminder, siteUrl))
    )

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
