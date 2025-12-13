import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
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

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development without secret
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const now = new Date()
    const currentHour = now.getUTCHours()
    const currentDay = now.getUTCDay() // 0 = Sunday

    // Find users who should receive digests now
    const { data: eligibleUsers, error: usersError } = await supabaseAdmin
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

    const results = { sent: 0, skipped: 0, errors: 0 }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stickmynote.com"

    for (const pref of eligibleUsers || []) {
      try {
        // Check if it's the right time to send
        const digestHour = pref.digest_time ? Number.parseInt(pref.digest_time.split(":")[0], 10) : 9 // Default 9 AM

        if (currentHour !== digestHour) {
          results.skipped++
          continue
        }

        // For weekly digests, check day of week
        if (pref.digest_frequency === "weekly") {
          const digestDay = pref.digest_day_of_week ?? 1 // Default Monday
          if (currentDay !== digestDay) {
            results.skipped++
            continue
          }
        }

        const usersArray = pref.users as { id: string; email: string; full_name: string }[] | null
        const user = usersArray?.[0]
        if (!user?.email) {
          results.skipped++
          continue
        }

        // Calculate period
        const periodEnd = now
        const periodStart = new Date(now)
        if (pref.digest_frequency === "daily") {
          periodStart.setDate(periodStart.getDate() - 1)
        } else {
          periodStart.setDate(periodStart.getDate() - 7)
        }

        // Fetch notifications for this user in the period
        const { data: notifications, error: notifError } = await supabaseAdmin
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .gte("created_at", periodStart.toISOString())
          .lte("created_at", periodEnd.toISOString())
          .order("created_at", { ascending: false })

        if (notifError) {
          results.errors++
          continue
        }

        if (!notifications || notifications.length === 0) {
          results.skipped++
          continue
        }

        // Group notifications by pad
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

          // Categorize by type
          switch (notif.type) {
            case "stick_created":
              summary.newSticks++
              break
            case "stick_updated":
            case "status_changed":
              summary.statusChanges++
              break
            case "blocker":
            case "blocker_created":
              summary.unresolvedBlockers++
              break
            case "mention":
            case "mentioned":
              summary.mentions++
              break
            case "reply":
            case "stick_replied":
              summary.replies++
              break
          }
        }

        const padSummaries = Array.from(padMap.values()).sort((a, b) => b.notifications.length - a.notifications.length)

        const digestData: DigestEmailData = {
          userName: user.full_name || "",
          frequency: pref.digest_frequency as "daily" | "weekly",
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          totalNotifications: notifications.length,
          padSummaries,
          siteUrl,
        }

        const html = generateDigestEmailHtml(digestData)
        const text = generateDigestPlainText(digestData)

        const emailResult = await sendEmail({
          to: user.email,
          subject: `Your ${pref.digest_frequency === "daily" ? "Daily" : "Weekly"} Digest - ${notifications.length} update${notifications.length !== 1 ? "s" : ""}`,
          html,
          text,
        })

        if (emailResult.success) {
          results.sent++

          // Log the digest send
          await supabaseAdmin.from("notification_digest_queue").insert({
            user_id: user.id,
            notification_data: { count: notifications.length, padCount: padSummaries.length },
            scheduled_for: now.toISOString(),
            sent_at: now.toISOString(),
          })
        } else {
          results.errors++
        }
      } catch (userError) {
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
