// v2 Calsticks iCal Feed API: production-quality, generate iCal feed
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/feed/ical/[token] - Get iCal feed by token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return new Response('Missing token', { status: 400 })
    }

    // 1. Validate Token & Get User
    const feedResult = await db.query(
      `SELECT user_id, filters FROM paks_pad_calendar_feeds
       WHERE token = $1 AND is_active = true`,
      [token]
    )

    if (feedResult.rows.length === 0) {
      return new Response('Invalid or inactive feed token', { status: 404 })
    }

    const feed = feedResult.rows[0]

    // 2. Fetch Tasks for User
    const tasksResult = await db.query(
      `SELECT
        r.id,
        r.content,
        r.calstick_date,
        r.calstick_start_date,
        r.calstick_status,
        r.calstick_priority,
        r.calstick_completed,
        r.updated_at,
        r.created_at,
        s.topic as stick_topic,
        s.content as stick_content
       FROM paks_pad_stick_replies r
       LEFT JOIN paks_pad_sticks s ON r.stick_id = s.id
       WHERE r.is_calstick = true
         AND (r.user_id = $1 OR r.calstick_assignee_id = $1)
         AND r.calstick_completed = false
       ORDER BY r.calstick_date ASC NULLS LAST`,
      [feed.user_id]
    )

    const tasks = tasksResult.rows

    // 3. Generate iCal String
    const icsContent: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//StickMyNote//CalSticks//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:My CalSticks',
      'X-WR-TIMEZONE:UTC',
    ]

    tasks.forEach((task: any) => {
      if (!task.calstick_date) return // Skip tasks without dates

      const startDate = task.calstick_start_date
        ? new Date(task.calstick_start_date)
        : new Date(task.calstick_date)
      const endDate = new Date(task.calstick_date)

      // Ensure end is at least start + 1 hour
      if (endDate < startDate) {
        endDate.setTime(startDate.getTime() + 3600000)
      }

      const startStr = startDate.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
      const endStr = endDate.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
      const dtStamp =
        new Date(task.updated_at || task.created_at)
          .toISOString()
          .replace(/[-:.]/g, '')
          .slice(0, 15) + 'Z'

      const summary = (task.stick_topic || 'Untitled Task').replace(/,/g, '\\,')
      const description = (task.content || '').replace(/\n/g, '\\n').replace(/,/g, '\\,')
      const priorityMap: Record<string, number> = {
        urgent: 1,
        high: 3,
        medium: 5,
        low: 7,
        none: 0,
      }
      const priority = priorityMap[task.calstick_priority] || 0

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${task.id}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${startStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `PRIORITY:${priority}`,
        `STATUS:${task.calstick_status?.toUpperCase().replace('-', '_') || 'NEEDS_ACTION'}`,
        'END:VEVENT'
      )
    })

    icsContent.push('END:VCALENDAR')

    // 4. Update access stats
    await db.query(
      `UPDATE paks_pad_calendar_feeds SET last_accessed_at = NOW() WHERE token = $1`,
      [token]
    )

    return new Response(icsContent.join('\r\n'), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="calsticks.ics"',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
