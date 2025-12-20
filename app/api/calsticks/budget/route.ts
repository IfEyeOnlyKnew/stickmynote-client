import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = { id: authResult.userId }

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { data: calstickReplies, error: repliesError } = await db
      .from("paks_pad_stick_replies")
      .select("stick_id")
      .eq("is_calstick", true)
      .eq("org_id", orgContext.orgId)
      .not("calstick_date", "is", null)

    if (repliesError) {
      return NextResponse.json({ error: "Failed to fetch calstick replies" }, { status: 500 })
    }

    const stickIds = [...new Set(calstickReplies?.map((r: { stick_id: string }) => r.stick_id) || [])]

    if (stickIds.length === 0) {
      return NextResponse.json({ projects: [] })
    }

    const { data: sticks, error: sticksError } = await db
      .from("paks_pad_sticks")
      .select("pad_id")
      .in("id", stickIds)
      .eq("org_id", orgContext.orgId)

    if (sticksError) {
      return NextResponse.json({ error: "Failed to fetch sticks" }, { status: 500 })
    }

    const padIdsWithCalSticks = [...new Set(sticks?.map((s) => s.pad_id).filter(Boolean) || [])]

    if (padIdsWithCalSticks.length === 0) {
      return NextResponse.json({ projects: [] })
    }

    const { data: memberPads } = await db
      .from("paks_pad_members")
      .select("pad_id")
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    const memberPadIds = memberPads?.map((mp) => mp.pad_id) || []

    let query = db
      .from("paks_pads")
      .select("id, name, budget_cents, hourly_rate_cents, is_billable")
      .in("id", padIdsWithCalSticks)
      .eq("org_id", orgContext.orgId)

    if (memberPadIds.length > 0) {
      const accessiblePadIds = padIdsWithCalSticks.filter((padId) => memberPadIds.includes(padId))
      query = query.or(`owner_id.eq.${user.id},id.in.(${accessiblePadIds.join(",")})`)
    } else {
      query = query.eq("owner_id", user.id)
    }

    const { data: pads, error: padsError } = await query

    if (padsError) {
      return NextResponse.json({ error: "Failed to fetch pads" }, { status: 500 })
    }

    const padIds = pads.map((p) => p.id)
    const { data: tasks, error: tasksError } = await db
      .from("paks_pad_stick_replies")
      .select(`
        id,
        content,
        stick_id,
        calstick_estimated_hours,
        calstick_actual_hours,
        calstick_assignee_id,
        calstick_status,
        paks_pad_sticks!inner(pad_id)
      `)
      .eq("is_calstick", true)
      .eq("org_id", orgContext.orgId)
      .not("calstick_date", "is", null)
      .in("paks_pad_sticks.pad_id", padIds)

    if (tasksError) {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    const assigneeIds = [...new Set(tasks.map((t) => t.calstick_assignee_id).filter(Boolean))]
    const { data: users } = await db
      .from("users")
      .select("id, full_name, email, hourly_rate_cents")
      .in("id", assigneeIds)

    type UserInfo = { id: string; full_name: string | null; email: string | null; hourly_rate_cents: number | null }
    const userMap = new Map<string, UserInfo>(users?.map((u: UserInfo) => [u.id, u]) || [])

    const projects = pads.map((pad) => {
      const padTasks = tasks
        .filter((t) => (t.paks_pad_sticks as any).pad_id === pad.id)
        .map((task) => {
          const assignee = task.calstick_assignee_id ? userMap.get(task.calstick_assignee_id) : null
          const assigneeRate = assignee?.hourly_rate_cents || pad.hourly_rate_cents || 0

          return {
            id: task.id,
            content: task.content,
            estimatedHours: task.calstick_estimated_hours || 0,
            actualHours: task.calstick_actual_hours || 0,
            assigneeId: task.calstick_assignee_id,
            assigneeName: assignee?.full_name || assignee?.email || null,
            assigneeRate,
            status: task.calstick_status || "todo",
          }
        })

      const totalEstimatedCost = padTasks.reduce((sum, t) => sum + t.estimatedHours * t.assigneeRate, 0)
      const totalActualCost = padTasks.reduce((sum, t) => sum + t.actualHours * t.assigneeRate, 0)
      const budgetCents = pad.budget_cents || 0
      const remainingBudget = budgetCents - totalActualCost
      const percentSpent = budgetCents > 0 ? (totalActualCost / budgetCents) * 100 : 0

      return {
        padId: pad.id,
        padName: pad.name,
        budgetCents,
        hourlyRateCents: pad.hourly_rate_cents || 0,
        isBillable: pad.is_billable || false,
        tasks: padTasks,
        totalEstimatedCost,
        totalActualCost,
        remainingBudget,
        percentSpent: Math.min(percentSpent, 100),
      }
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error("[calsticks/budget GET] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = { id: authResult.userId }

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()
    const { padId, budgetCents, hourlyRateCents, isBillable } = body

    const { error: updateError } = await db
      .from("paks_pads")
      .update({
        budget_cents: budgetCents,
        hourly_rate_cents: hourlyRateCents,
        is_billable: isBillable,
      })
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to update budget" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[calsticks/budget POST] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
