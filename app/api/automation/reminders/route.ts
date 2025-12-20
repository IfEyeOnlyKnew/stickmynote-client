import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { taskReminderSchema } from "@/types/automation"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(req: NextRequest) {
  try {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await req.json()
    const { taskId, ...reminderData } = body

    const validation = taskReminderSchema.safeParse(reminderData)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 })
    }

    const { data: reminder, error } = await db
      .from("task_reminders")
      .insert({
        task_id: taskId,
        user_id: user.id,
        org_id: orgContext.orgId,
        ...validation.data,
        is_sent: false,
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ reminder })
  } catch (error) {
    console.error("[reminders] Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId")
  if (!taskId) return NextResponse.json({ error: "Task ID required" }, { status: 400 })

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

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return NextResponse.json({ error: "No organization context" }, { status: 403 })
  }

  const { data: reminders, error } = await db
    .from("task_reminders")
    .select("*")
    .eq("task_id", taskId)
    .eq("org_id", orgContext.orgId)
    .eq("is_sent", false)
    .order("remind_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reminders })
}
