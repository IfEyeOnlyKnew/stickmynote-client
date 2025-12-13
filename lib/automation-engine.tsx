import { createClient } from "@/lib/supabase/server"

type TriggerEvent = "task_created" | "task_updated" | "task_completed" | "status_changed" | "priority_changed"

export async function runAutomationRules(event: TriggerEvent, task: any, previousTask?: any, userId?: string) {
  if (!userId) return

  const supabase = await createClient()

  // 1. Fetch active rules for this user and event
  const { data: rules, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("trigger_event", event)
    .eq("is_active", true)

  if (error || !rules || rules.length === 0) return

  // 2. Evaluate and execute each rule
  for (const rule of rules) {
    try {
      if (evaluateCondition(rule.trigger_conditions, task, previousTask)) {
        await executeAction(rule.action_type, rule.action_config, task, userId, supabase)
      }
    } catch (err) {
      console.error(`[Automation] Error executing rule ${rule.id}:`, err)
    }
  }
}

function evaluateCondition(conditions: any, task: any, previousTask?: any): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true

  for (const [key, value] of Object.entries(conditions)) {
    // Handle nested keys if needed, keeping it simple for now
    const taskValue = task[key]

    // Special check for status changes if we have previous task
    if (key === "previous_status" && previousTask) {
      if (previousTask.calstick_status !== value) return false
      continue
    }

    if (taskValue !== value) return false
  }
  return true
}

async function executeAction(type: string, config: any, task: any, userId: string, supabase: any) {
  switch (type) {
    case "send_notification":
      await supabase.from("notifications").insert({
        user_id: config.recipient_id || task.user_id,
        type: "tag",
        title: config.title || "Automation Alert",
        message: config.message || `Automation triggered for task: ${task.content}`,
        related_id: task.id,
        related_type: "reply",
      })
      break

    case "send_email":
      try {
        // Get recipient email (default to task owner)
        const recipientId = config.recipient_id || task.user_id
        const { data: userData } = await supabase.from("profiles").select("email").eq("id", recipientId).single()

        if (!userData?.email) {
          // Fallback to auth.users if profile doesn't have email
          const { data: authData } = await supabase.auth.admin.getUserById(recipientId)
          if (!authData?.user?.email) {
            console.error("[Automation] No email found for recipient:", recipientId)
            break
          }
          userData.email = authData.user.email
        }

        const subject = config.subject || `Task Update: ${task.content?.substring(0, 50) || "Task"}`
        const message = config.message || `Your task "${task.content}" has been updated.`

        // Call the send-email API
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        await fetch(`${siteUrl}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: userData.email,
            subject,
            html: `<div style="font-family: sans-serif; max-width: 600px;">
              <h2>${subject}</h2>
              <p>${message}</p>
              <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                <p><strong>Task:</strong> ${task.content || "No content"}</p>
                <p><strong>Status:</strong> ${task.calstick_status || "N/A"}</p>
                <p><strong>Priority:</strong> ${task.calstick_priority || "N/A"}</p>
                ${task.calstick_date ? `<p><strong>Due Date:</strong> ${new Date(task.calstick_date).toLocaleDateString()}</p>` : ""}
              </div>
              <p style="margin-top: 20px; color: #666; font-size: 12px;">
                This is an automated notification from your task management system.
              </p>
            </div>`,
            text: `${subject}\n\n${message}\n\nTask: ${task.content}\nStatus: ${task.calstick_status}\nPriority: ${task.calstick_priority}`,
          }),
        })
      } catch (err) {
        console.error("[Automation] Error sending email:", err)
      }
      break

    case "create_subtask":
      if (!config.content) return

      await supabase.from("paks_pad_stick_replies").insert({
        stick_id: task.stick_id,
        user_id: task.user_id,
        content: config.content,
        calstick_parent_id: task.id,
        is_calstick: true,
        calstick_status: "todo",
        calstick_date: task.calstick_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      break

    case "update_task":
      const updates: any = {}
      if (config.priority) updates.calstick_priority = config.priority
      if (config.status) updates.calstick_status = config.status

      if (Object.keys(updates).length > 0) {
        await supabase.from("paks_pad_stick_replies").update(updates).eq("id", task.id)
      }
      break

    default:
      console.log(`[Automation] Unknown action type: ${type}`)
  }
}
