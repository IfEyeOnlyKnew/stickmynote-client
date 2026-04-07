// Shared handler logic for automation reminders (v1 + v2 deduplication)
import { NextResponse } from "next/server"
import { query, querySingle } from "@/lib/database/pg-helpers"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

// Shared auth + org guard
async function getAuthAndOrg(): Promise<
  { error: NextResponse } | { user: { id: string; email?: string }; orgId: string }
> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    }
  }
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: NextResponse.json({ error: "No organization context" }, { status: 403 }) }
  }

  return { user: authResult.user, orgId: orgContext.orgId }
}

// GET - List reminders for a task
export async function handleGetReminders(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 })
    }

    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const reminders = await query(
      `SELECT * FROM task_reminders
       WHERE task_id = $1 AND org_id = $2 AND is_sent = false
       ORDER BY remind_at ASC`,
      [taskId, auth.orgId],
    )

    return NextResponse.json({ reminders })
  } catch (error) {
    console.error("[reminders GET] Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// POST - Create a reminder
export async function handleCreateReminder(request: Request): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const body = await request.json()
    const { taskId, remind_at, reminder_type, message } = body

    if (!taskId || !remind_at || !reminder_type) {
      return NextResponse.json(
        { error: "taskId, remind_at, and reminder_type are required" },
        { status: 400 },
      )
    }

    const reminder = await querySingle(
      `INSERT INTO task_reminders (task_id, user_id, org_id, remind_at, reminder_type, message, is_sent)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [taskId, auth.user.id, auth.orgId, remind_at, reminder_type, message],
    )

    return NextResponse.json({ reminder })
  } catch (error) {
    console.error("[reminders POST] Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
