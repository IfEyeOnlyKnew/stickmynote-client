import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"

// Generic Email Webhook Handler
// Expects standard fields often provided by services like SendGrid/Postmark/Mailgun
// or a simplified JSON payload: { sender, recipient, subject, body }
export async function POST(request: NextRequest) {
  try {
    const db = await createServiceDatabaseClient()
    // Authenticate webhook?
    // In production, verify signatures from provider (e.g. Stripe/SendGrid signatures).
    // For now, we'll accept open POSTs but could rely on a secret query param.

    const body = await request.json()
    const { sender, recipient, subject, text, html } = body

    if (!sender || !recipient) {
      return NextResponse.json({ error: "Missing sender or recipient" }, { status: 400 })
    }

    console.log(`[v0] Received email webhook from ${sender} to ${recipient}`)

    // 1. Identify User
    // Format: task+USER_UUID@... or just match sender email to a user
    let userId: string | null = null

    // Method A: Check if recipient contains user ID (e.g. task+123-456...@...)
    // Simple regex to find UUID in recipient
    const uuidMatch = recipient.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)

    if (uuidMatch) {
      userId = uuidMatch[1]
    } else {
      // Method B: Match sender address to a registered user
      const { data: user } = await db.from("users").select("id").eq("email", sender).single()

      if (user) userId = user.id
    }

    if (!userId) {
      // Log failure
      await logEmail(sender, recipient, subject, "failed", "User not found")
      return NextResponse.json({ error: "User identification failed" }, { status: 404 })
    }

    // 2. Create Task
    // We need a "Stick" to attach this reply/task to.
    // We can create a "Inbox" stick for the user if it doesn't exist,
    // or use a default "Email Imports" stick.

    // Find or create "Email Tasks" Stick
    let stickId: string | null = null

    // Search for existing "Inbox" stick
    const { data: existingStick } = await db
      .from("paks_pad_sticks")
      .select("id")
      .eq("user_id", userId)
      .eq("topic", "Inbox")
      .single()

    if (existingStick) {
      stickId = existingStick.id
    } else {
      // Create new Inbox stick
      // Need a pad... assume first pad or create one?
      // For simplicity, let's try to find ANY pad owned by user, or create a "Personal" pad

      const { data: pads } = await db.from("paks_pads").select("id").eq("owner_id", userId).limit(1)

      let padId = pads?.[0]?.id

      if (!padId) {
        // Create Personal Pad
        const { data: newPad } = await db
          .from("paks_pads")
          .insert({ name: "Personal", owner_id: userId })
          .select()
          .single()
        padId = newPad?.id
      }

      if (padId) {
        const { data: newStick } = await db
          .from("paks_pad_sticks")
          .insert({
            user_id: userId,
            pad_id: padId,
            topic: "Inbox",
            content: "Tasks created from email",
          })
          .select()
          .single()
        stickId = newStick?.id
      }
    }

    if (!stickId) {
      await logEmail(sender, recipient, subject, "failed", "Could not determine target Stick/Pad")
      return NextResponse.json({ error: "Target setup failed" }, { status: 500 })
    }

    // Create the Task (CalStick)
    const content = `${subject}\n\n${text || html || ""}`.trim()

    const { data: newTask, error: taskError } = await db
      .from("paks_pad_stick_replies")
      .insert({
        stick_id: stickId,
        user_id: userId,
        content: content.substring(0, 3000), // Truncate if needed
        is_calstick: true,
        calstick_status: "todo",
        calstick_priority: "medium",
        calstick_date: new Date().toISOString(), // Today
      })
      .select()
      .single()

    if (taskError) {
      console.error("Task creation error:", taskError)
      await logEmail(sender, recipient, subject, "failed", taskError.message)
      return NextResponse.json({ error: "Task creation failed" }, { status: 500 })
    }

    await logEmail(sender, recipient, subject, "processed", null, newTask.id)
    return NextResponse.json({ success: true, taskId: newTask.id })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

async function logEmail(
  sender: string,
  recipient: string,
  subject: string | undefined,
  status: string,
  error?: string | null,
  taskId?: string,
) {
  try {
    const db = await createServiceDatabaseClient()
    await db.from("inbound_email_logs").insert({
      sender_email: sender,
      recipient_email: recipient,
      subject: subject,
      status,
      error_message: error,
      created_task_id: taskId,
    })
  } catch (e) {
    console.error("Logging failed", e)
  }
}
