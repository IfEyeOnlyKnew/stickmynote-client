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

  // For weekly with specific days
  if (type === "weekly" && meeting.recurrence_days_of_week?.length) {
    return expandWeeklyWithDays(meeting.recurrence_days_of_week, startDate, interval, duration, maxCount, recurrenceEnd, rangeStart, rangeEnd)
  }

  // For daily, weekly (no specific days), monthly, yearly
  return expandSimpleRecurrence(type, meeting, startDate, interval, duration, maxCount, recurrenceEnd, rangeStart, rangeEnd)
}

function expandWeeklyWithDays(
  daysOfWeek: number[],
  startDate: Date,
  interval: number,
  duration: number,
  maxCount: number,
  recurrenceEnd: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
): OccurrenceDate[] {
  const occurrences: OccurrenceDate[] = []
  let count = 0
  const days = daysOfWeek.toSorted((a, b) => a - b)
  const weekStart = new Date(startDate)
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
        occurrences.push(createOccurrence(occDate, duration))
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

function expandSimpleRecurrence(
  type: string,
  meeting: RecurrenceParams,
  startDate: Date,
  interval: number,
  duration: number,
  maxCount: number,
  recurrenceEnd: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
): OccurrenceDate[] {
  const occurrences: OccurrenceDate[] = []
  let count = 0
  const current = new Date(startDate)

  while (count < maxCount) {
    if (recurrenceEnd && current > recurrenceEnd) break
    if (shouldStopExpansion(current, rangeEnd, occurrences.length)) break

    if (current >= rangeStart && current <= rangeEnd) {
      occurrences.push(createOccurrence(new Date(current), duration))
    }

    count++
    advanceDate(current, type, interval, meeting.recurrence_day_of_month)
  }

  return occurrences
}

function createOccurrence(start: Date, duration: number): OccurrenceDate {
  return {
    start,
    end: new Date(start.getTime() + duration),
    instanceDate: formatDate(start),
  }
}

function shouldStopExpansion(current: Date, rangeEnd: Date, occurrenceCount: number): boolean {
  if (current <= rangeEnd) return false
  // Allow a small buffer past rangeEnd in case we haven't started yet
  return occurrenceCount > 0 || current > new Date(rangeEnd.getTime() + 86400000)
}

function advanceDate(current: Date, type: string, interval: number, dayOfMonth: number | null): void {
  switch (type) {
    case "daily":
      current.setDate(current.getDate() + interval)
      break
    case "weekly":
      current.setDate(current.getDate() + 7 * interval)
      break
    case "monthly":
      current.setMonth(current.getMonth() + interval)
      if (dayOfMonth) {
        current.setDate(Math.min(dayOfMonth, daysInMonth(current)))
      }
      break
    case "yearly":
      current.setFullYear(current.getFullYear() + interval)
      break
  }
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
  const desc = describeRecurrenceType(type, interval, meeting)
  return appendRecurrenceEnd(desc, meeting)
}

function describeRecurrenceType(type: string, interval: number, meeting: RecurrenceParams): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  switch (type) {
    case "daily":
      return interval === 1 ? "Every day" : `Every ${interval} days`
    case "weekly":
      return describeWeekly(interval, meeting.recurrence_days_of_week, dayNames)
    case "monthly":
      return describeMonthly(interval, meeting.recurrence_day_of_month)
    case "yearly":
      return interval === 1 ? "Every year" : `Every ${interval} years`
    default:
      return ""
  }
}

function describeWeekly(interval: number, daysOfWeek: number[] | null, dayNames: string[]): string {
  if (daysOfWeek?.length) {
    const days = daysOfWeek.map((d) => dayNames[d]).join(", ")
    return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`
  }
  return interval === 1 ? "Every week" : `Every ${interval} weeks`
}

function describeMonthly(interval: number, dayOfMonth: number | null): string {
  if (dayOfMonth) {
    return interval === 1
      ? `Monthly on the ${ordinal(dayOfMonth)}`
      : `Every ${interval} months on the ${ordinal(dayOfMonth)}`
  }
  return interval === 1 ? "Every month" : `Every ${interval} months`
}

function appendRecurrenceEnd(desc: string, meeting: RecurrenceParams): string {
  if (meeting.recurrence_end_date) {
    return `${desc} until ${new Date(meeting.recurrence_end_date).toLocaleDateString()}`
  }
  if (meeting.recurrence_count) {
    return `${desc}, ${meeting.recurrence_count} times`
  }
  return desc
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
