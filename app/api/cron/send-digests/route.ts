import { NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { sendEmail } from "@/lib/email/resend"
import {
  generateDigestEmailHtml,
  generateDigestPlainText,
  type DigestEmailData,
  type PadDigestSummary,
  type DigestNotification,
} from "@/lib/email/digest-templates"

// Vercel cron - runs every hour at minute 0
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Constants
const DEFAULT_DIGEST_HOUR = 9 // 9 AM
const DEFAULT_DIGEST_DAY = 1 // Monday
const DAILY_PERIOD_DAYS = 1
const WEEKLY_PERIOD_DAYS = 7
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stickmynote.com"

// Notification type to category mapping
const NOTIFICATION_CATEGORIES: Record<string, keyof Pick<PadDigestSummary, "newSticks" | "statusChanges" | "unresolvedBlockers" | "mentions" | "replies">> = {
  stick_created: "newSticks",
  stick_updated: "statusChanges",
  status_changed: "statusChanges",
  blocker: "unresolvedBlockers",
  blocker_created: "unresolvedBlockers",
  mention: "mentions",
  mentioned: "mentions",
  reply: "replies",
  stick_replied: "replies",
}

interface UserPreference {
  user_id: string
  digest_frequency: string
  digest_time: string | null
  digest_day_of_week: number | null
  users: { id: string; email: string; full_name: string }[] | null
}

interface DigestResults {
  sent: number
  skipped: number
  errors: number
}

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  return process.env.NODE_ENV !== "production"
}

function isDigestTimeMatch(pref: UserPreference, currentHour: number, currentDay: number): boolean {
  const digestHour = pref.digest_time 
    ? Number.parseInt(pref.digest_time.split(":")[0], 10) 
    : DEFAULT_DIGEST_HOUR

  if (currentHour !== digestHour) return false

  if (pref.digest_frequency === "weekly") {
    const digestDay = pref.digest_day_of_week ?? DEFAULT_DIGEST_DAY
    if (currentDay !== digestDay) return false
  }

  return true
}

function calculatePeriod(frequency: string, now: Date): { start: Date; end: Date } {
  const periodEnd = now
  const periodStart = new Date(now)
  const days = frequency === "daily" ? DAILY_PERIOD_DAYS : WEEKLY_PERIOD_DAYS
  periodStart.setDate(periodStart.getDate() - days)
  return { start: periodStart, end: periodEnd }
}

function groupNotificationsByPad(notifications: any[]): PadDigestSummary[] {
  const padMap = new Map<string, PadDigestSummary>()

  for (const notif of notifications) {
    const padId = (notif.metadata?.pad_id as string) || "general"
    const padName = (notif.metadata?.pad_name as string) || "General"

    if (!padMap.has(padId)) {
      padMap.set(padId, {
        padId,
        padName,
        newSticks: 0,
        statusChanges: 0,
        unresolvedBlockers: 0,
        mentions: 0,
        replies: 0,
        notifications: [],
      })
    }

    const summary = padMap.get(padId)!
    
    const digestNotif: DigestNotification = {
      id: notif.id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      created_at: notif.created_at,
      action_url: notif.action_url,
      metadata: notif.metadata,
    }
    summary.notifications.push(digestNotif)

    // Increment category counter using mapping
    const category = NOTIFICATION_CATEGORIES[notif.type]
    if (category) {
      summary[category]++
    }
  }

  return Array.from(padMap.values()).sort((a, b) => b.notifications.length - a.notifications.length)
}

function buildDigestSubject(frequency: string, count: number): string {
  const frequencyLabel = frequency === "daily" ? "Daily" : "Weekly"
  const updateLabel = count === 1 ? "update" : "updates"
  return `Your ${frequencyLabel} Digest - ${count} ${updateLabel}`
}

async function processUserDigest(
  db: DatabaseClient,
  pref: UserPreference,
  now: Date,
): Promise<"sent" | "skipped" | "error"> {
  const user = pref.users?.[0]
  if (!user?.email) return "skipped"

  const { start: periodStart, end: periodEnd } = calculatePeriod(pref.digest_frequency, now)

  const { data: notifications, error: notifError } = await db
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString())
    .order("created_at", { ascending: false })

  if (notifError) return "error"
  if (!notifications?.length) return "skipped"

  const padSummaries = groupNotificationsByPad(notifications)

  const digestData: DigestEmailData = {
    userName: user.full_name || "",
    frequency: pref.digest_frequency as "daily" | "weekly",
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalNotifications: notifications.length,
    padSummaries,
    siteUrl: SITE_URL,
  }

  const emailResult = await sendEmail({
    to: user.email,
    subject: buildDigestSubject(pref.digest_frequency, notifications.length),
    html: generateDigestEmailHtml(digestData),
    text: generateDigestPlainText(digestData),
  })

  if (!emailResult.success) return "error"

  // Log the digest send
  await db.from("notification_digest_queue").insert({
    user_id: user.id,
    notification_data: { count: notifications.length, padCount: padSummaries.length },
    scheduled_for: now.toISOString(),
    sent_at: now.toISOString(),
  })

  return "sent"
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = await createServiceDatabaseClient()
    const now = new Date()
    const currentHour = now.getUTCHours()
    const currentDay = now.getUTCDay()

    const { data: eligibleUsers, error: usersError } = await db
      .from("notification_preferences")
      .select(`
        user_id,
        digest_frequency,
        digest_time,
        digest_day_of_week,
        users!notification_preferences_user_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .in("digest_frequency", ["daily", "weekly"])
      .eq("email_enabled", true)

    if (usersError) {
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    const results: DigestResults = { sent: 0, skipped: 0, errors: 0 }

    for (const pref of (eligibleUsers || []) as UserPreference[]) {
      if (!isDigestTimeMatch(pref, currentHour, currentDay)) {
        results.skipped++
        continue
      }

      try {
        const status = await processUserDigest(db, pref, now)
        results[status === "sent" ? "sent" : status === "error" ? "errors" : "skipped"]++
      } catch {
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
