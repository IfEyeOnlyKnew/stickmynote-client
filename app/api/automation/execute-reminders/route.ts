import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// This endpoint should be called by a cron job (e.g., Vercel Cron or external service)
// to check for pending reminders and send them
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const now = new Date().toISOString()

    const { data: reminders, error } = await supabase
      .from("task_reminders")
      .select("*, stick_replies!inner(*, org_id)")
      .eq("is_sent", false)
      .lte("remind_at", now)
      .limit(100)

    if (error) throw error

    const results = []
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

    for (const reminder of reminders || []) {
      try {
        const task = reminder.stick_replies

        if (reminder.reminder_type === "notification") {
          await supabase.from("notifications").insert({
            user_id: reminder.user_id,
            org_id: task.org_id,
            type: "tag",
            title: "Task Reminder",
            message: reminder.message || `Reminder: ${task.content}`,
            related_id: task.id,
            related_type: "reply",
          })
        } else if (reminder.reminder_type === "email") {
          // Get user email
          const { data: userData } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", reminder.user_id)
            .maybeSingle()

          if (userData?.email) {
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
        }

        // Mark reminder as sent
        await supabase
          .from("task_reminders")
          .update({ is_sent: true, sent_at: new Date().toISOString() })
          .eq("id", reminder.id)

        results.push({ id: reminder.id, status: "sent" })
      } catch (err) {
        console.error(`Error sending reminder ${reminder.id}:`, err)
        results.push({ id: reminder.id, status: "error" })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error("Error executing reminders:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
