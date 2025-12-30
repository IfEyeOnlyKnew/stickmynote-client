import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"

interface TaskReminder {
  id: string
  user_id: string
  reminder_type: "notification" | "email"
  message?: string
  stick_replies: {
    id: string
    org_id: string
    content: string
    calstick_status?: string
    calstick_date?: string
  }
}

// Helper: Send notification reminder
async function sendNotificationReminder(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  reminder: TaskReminder,
) {
  const task = reminder.stick_replies
  await db.from("notifications").insert({
    user_id: reminder.user_id,
    org_id: task.org_id,
    type: "tag",
    title: "Task Reminder",
    message: reminder.message || `Reminder: ${task.content}`,
    related_id: task.id,
    related_type: "reply",
  })
}

// Helper: Send email reminder
async function sendEmailReminder(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  reminder: TaskReminder,
  siteUrl: string,
) {
  const task = reminder.stick_replies
  const { data: userData } = await db
    .from("profiles")
    .select("email")
    .eq("id", reminder.user_id)
    .maybeSingle()

  if (!userData?.email) return

  await fetch(`${siteUrl}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: userData.email,
      subject: "Task Reminder",
      html: `<div style="font-family: sans-serif; max-width: 600px;">
        <h2>Task Reminder</h2>
        <p>${reminder.message || "You have a task reminder:"}</p>
        <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
          <p><strong>Task:</strong> ${task.content}</p>
          <p><strong>Status:</strong> ${task.calstick_status}</p>
          ${task.calstick_date ? `<p><strong>Due Date:</strong> ${new Date(task.calstick_date).toLocaleDateString()}</p>` : ""}
        </div>
      </div>`,
      text: `Task Reminder: ${task.content}`,
    }),
  })
}

// Helper: Process a single reminder
async function processReminder(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  reminder: TaskReminder,
  siteUrl: string,
): Promise<{ id: string; status: string }> {
  try {
    if (reminder.reminder_type === "notification") {
      await sendNotificationReminder(db, reminder)
    } else if (reminder.reminder_type === "email") {
      await sendEmailReminder(db, reminder, siteUrl)
    }

    await db
      .from("task_reminders")
      .update({ is_sent: true, sent_at: new Date().toISOString() })
      .eq("id", reminder.id)

    return { id: reminder.id, status: "sent" }
  } catch (err) {
    console.error(`Error sending reminder ${reminder.id}:`, err)
    return { id: reminder.id, status: "error" }
  }
}

// This endpoint should be called by a cron job (e.g., Vercel Cron or external service)
// to check for pending reminders and send them
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await createDatabaseClient()
    const now = new Date().toISOString()

    // Fetch reminders without join
    const { data: reminders, error } = await db
      .from("task_reminders")
      .select("*")
      .eq("is_sent", false)
      .lte("remind_at", now)
      .limit(100)

    if (error) throw error

    // Get reply IDs from reminders and fetch stick_replies separately
    const replyIds = (reminders || []).map((r: any) => r.reply_id).filter(Boolean)
    let repliesMap = new Map<string, any>()

    if (replyIds.length > 0) {
      const { data: replies } = await db
        .from("stick_replies")
        .select("id, org_id, content, calstick_status, calstick_date")
        .in("id", replyIds)

      for (const reply of replies || []) {
        repliesMap.set(reply.id, reply)
      }
    }

    // Combine reminders with their replies
    const remindersWithReplies = (reminders || [])
      .map((reminder: any) => ({
        ...reminder,
        stick_replies: repliesMap.get(reminder.reply_id) || null,
      }))
      .filter((r: any) => r.stick_replies) // Only process reminders with valid replies

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

    const results = await Promise.all(
      remindersWithReplies.map((reminder: any) => processReminder(db, reminder as TaskReminder, siteUrl))
    )

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error("Error executing reminders:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
