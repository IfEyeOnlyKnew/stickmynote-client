/**
 * Recurrence expansion logic for meetings.
 * Generates occurrence dates from a parent meeting's recurrence config.
 */

interface RecurrenceParams {
  recurrence_type: string | null
  recurrence_interval: number | null
  recurrence_days_of_week: number[] | null
  recurrence_day_of_month: number | null
  recurrence_end_date: string | null
  recurrence_count: number | null
  start_time: string
  end_time: string
}

export interface OccurrenceDate {
  start: Date
  end: Date
  instanceDate: string // YYYY-MM-DD
}

const MAX_OCCURRENCES = 365 // safety limit

/**
 * Expand a recurring meeting into individual occurrence dates
 * within the given date range.
 */
export function expandRecurrence(
  meeting: RecurrenceParams,
  rangeStart: Date,
  rangeEnd: Date
): OccurrenceDate[] {
  const type = meeting.recurrence_type
  if (!type || type === "none") return []

  const interval = meeting.recurrence_interval || 1
  const startDate = new Date(meeting.start_time)
  const endDate = new Date(meeting.end_time)
  const duration = endDate.getTime() - startDate.getTime()

  const recurrenceEnd = meeting.recurrence_end_date
    ? new Date(meeting.recurrence_end_date)
    : null
  const maxCount = meeting.recurrence_count || MAX_OCCURRENCES

  const occurrences: OccurrenceDate[] = []
  let count = 0

  // For weekly with specific days
  if (type === "weekly" && meeting.recurrence_days_of_week?.length) {
    const days = meeting.recurrence_days_of_week.sort((a, b) => a - b)
    let weekStart = new Date(startDate)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Go to Sunday

    while (count < maxCount) {
      for (const dayOfWeek of days) {
        const occDate = new Date(weekStart)
        occDate.setDate(occDate.getDate() + dayOfWeek)
        occDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds())

        if (occDate < startDate) continue
        if (recurrenceEnd && occDate > recurrenceEnd) return occurrences
        if (count >= maxCount) return occurrences

        if (occDate >= rangeStart && occDate <= rangeEnd) {
          const occEnd = new Date(occDate.getTime() + duration)
          occurrences.push({
            start: occDate,
            end: occEnd,
            instanceDate: formatDate(occDate),
          })
        }

        // If we're past the range, stop early
        if (occDate > rangeEnd && occurrences.length > 0) return occurrences

        count++
      }
      // Advance by interval weeks
      weekStart.setDate(weekStart.getDate() + 7 * interval)

      // Safety: if we've gone way past the range, stop
      if (weekStart > rangeEnd && weekStart > (recurrenceEnd || rangeEnd)) break
    }
    return occurrences
  }

  // For daily, weekly (no specific days), monthly, yearly
  let current = new Date(startDate)

  while (count < maxCount) {
    if (recurrenceEnd && current > recurrenceEnd) break
    // If we're way past the range, stop
    if (current > rangeEnd) {
      // Allow a small buffer past rangeEnd in case we haven't started yet
      if (occurrences.length > 0 || current > new Date(rangeEnd.getTime() + 86400000)) break
    }

    if (current >= rangeStart && current <= rangeEnd) {
      const occEnd = new Date(current.getTime() + duration)
      occurrences.push({
        start: new Date(current),
        end: occEnd,
        instanceDate: formatDate(current),
      })
    }

    count++

    // Advance to next occurrence
    switch (type) {
      case "daily":
        current.setDate(current.getDate() + interval)
        break
      case "weekly":
        current.setDate(current.getDate() + 7 * interval)
        break
      case "monthly":
        if (meeting.recurrence_day_of_month) {
          current.setMonth(current.getMonth() + interval)
          current.setDate(Math.min(meeting.recurrence_day_of_month, daysInMonth(current)))
        } else {
          current.setMonth(current.getMonth() + interval)
        }
        break
      case "yearly":
        current.setFullYear(current.getFullYear() + interval)
        break
    }
  }

  return occurrences
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Generate a human-readable description of a recurrence pattern.
 */
export function describeRecurrence(meeting: RecurrenceParams): string {
  const type = meeting.recurrence_type
  if (!type || type === "none") return "Does not repeat"

  const interval = meeting.recurrence_interval || 1
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  let desc = ""

  switch (type) {
    case "daily":
      desc = interval === 1 ? "Every day" : `Every ${interval} days`
      break
    case "weekly":
      if (meeting.recurrence_days_of_week?.length) {
        const days = meeting.recurrence_days_of_week.map((d) => dayNames[d]).join(", ")
        desc = interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`
      } else {
        desc = interval === 1 ? "Every week" : `Every ${interval} weeks`
      }
      break
    case "monthly":
      if (meeting.recurrence_day_of_month) {
        desc = interval === 1
          ? `Monthly on the ${ordinal(meeting.recurrence_day_of_month)}`
          : `Every ${interval} months on the ${ordinal(meeting.recurrence_day_of_month)}`
      } else {
        desc = interval === 1 ? "Every month" : `Every ${interval} months`
      }
      break
    case "yearly":
      desc = interval === 1 ? "Every year" : `Every ${interval} years`
      break
  }

  if (meeting.recurrence_end_date) {
    desc += ` until ${new Date(meeting.recurrence_end_date).toLocaleDateString()}`
  } else if (meeting.recurrence_count) {
    desc += `, ${meeting.recurrence_count} times`
  }

  return desc
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
