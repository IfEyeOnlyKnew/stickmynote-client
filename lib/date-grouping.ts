import { format, isToday, isYesterday } from "date-fns"

export interface DateGroup<T> {
  dateKey: string
  label: string
  items: T[]
}

function getDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "EEEE, MMMM d, yyyy")
}

export function groupByDate<T>(items: T[], getDate: (item: T) => string | null | undefined): DateGroup<T>[] {
  const groups: DateGroup<T>[] = []
  const map = new Map<string, DateGroup<T>>()

  for (const item of items) {
    const raw = getDate(item)
    if (!raw) continue
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) continue
    const key = getDateKey(date)
    let group = map.get(key)
    if (!group) {
      group = { dateKey: key, label: getDateLabel(date), items: [] }
      map.set(key, group)
      groups.push(group)
    }
    group.items.push(item)
  }

  groups.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
  return groups
}
