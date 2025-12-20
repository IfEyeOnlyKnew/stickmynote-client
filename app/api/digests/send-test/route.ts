import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { sendEmail } from "@/lib/email/resend"
import {
  generateDigestEmailHtml,
  generateDigestPlainText,
  type DigestEmailData,
  type PadDigestSummary,
  type DigestNotification,
} from "@/lib/email/digest-templates"

export async function POST(request: Request) {
  const db = await createDatabaseClient()

  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": "30" } },
    )
  }
  if (!authResult.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = authResult.user

  try {
    const { frequency = "daily" } = await request.json()

    const now = new Date()
    const periodEnd = now
    const periodStart = new Date(now)
    if (frequency === "daily") {
      periodStart.setDate(periodStart.getDate() - 1)
    } else {
      periodStart.setDate(periodStart.getDate() - 7)
    }

    // Fetch recent notifications
    const { data: notifications } = await db
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(50)

    // Fetch user profile
    const { data: profile } = await db.from("users").select("full_name, email").eq("id", user.id).single()

    if (!profile?.email) {
      return NextResponse.json({ error: "No email address found" }, { status: 400 })
    }

    // Group by pad
    const padMap = new Map<string, PadDigestSummary>()

    for (const notif of notifications || []) {
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stickmynote.com"

    const digestData: DigestEmailData = {
      userName: profile.full_name || "",
      frequency: frequency as "daily" | "weekly",
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalNotifications: notifications?.length || 0,
      padSummaries,
      siteUrl,
    }

    const html = generateDigestEmailHtml(digestData)
    const text = generateDigestPlainText(digestData)

    const result = await sendEmail({
      to: profile.email,
      subject: `[Test] Your ${frequency === "daily" ? "Daily" : "Weekly"} Digest - ${notifications?.length || 0} update${(notifications?.length || 0) !== 1 ? "s" : ""}`,
      html,
      text,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      emailId: result.id,
      notificationCount: notifications?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Send test digest error:", error)
    return NextResponse.json({ error: "Failed to send test digest" }, { status: 500 })
  }
}
