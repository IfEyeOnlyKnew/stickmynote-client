import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type { WorkflowStatus } from "@/types/inference-workflow"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: stick, error } = await db
      .from("social_sticks")
      .select(`
        id,
        workflow_status,
        workflow_owner_id,
        workflow_due_date,
        workflow_updated_at,
        calstick_id,
        promoted_at,
        promoted_by,
        workflow_owner:users!social_sticks_workflow_owner_id_fkey(
          id, full_name, email, avatar_url
        )
      `)
      .eq("id", stickId)
      .maybeSingle()

    if (error) {
      console.error("[v0] Error fetching workflow:", error)
      return NextResponse.json({ error: "Failed to fetch workflow" }, { status: 500 })
    }

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Fetch linked CalStick if exists
    let calstick: any = null
    if (stick.calstick_id) {
      const { data: cs } = await db
        .from("paks_pad_stick_replies")
        .select(`
          id,
          calstick_status,
          calstick_priority,
          calstick_completed,
          calstick_date,
          calstick_start_date,
          calstick_assignee_id
        `)
        .eq("id", stick.calstick_id)
        .maybeSingle()
      calstick = cs
    }

    return NextResponse.json({ workflow: { ...stick, calstick } })
  } catch (error) {
    console.error("[v0] Error in workflow GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()
    const { status, ownerId, dueDate } = body as {
      status?: WorkflowStatus
      ownerId?: string | null
      dueDate?: string | null
    }

    const updateData: Record<string, unknown> = {
      workflow_updated_at: new Date().toISOString(),
    }

    if (status !== undefined) {
      updateData.workflow_status = status
    }
    if (ownerId !== undefined) {
      updateData.workflow_owner_id = ownerId
    }
    if (dueDate !== undefined) {
      updateData.workflow_due_date = dueDate
    }

    const { data: stick, error } = await db
      .from("social_sticks")
      .update(updateData)
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .select(`
        id,
        workflow_status,
        workflow_owner_id,
        workflow_due_date,
        workflow_updated_at,
        calstick_id
      `)
      .maybeSingle()

    if (error) {
      console.error("[v0] Error updating workflow:", error)
      return NextResponse.json({ error: "Failed to update workflow" }, { status: 500 })
    }

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Sync with linked CalStick if exists
    if (stick.calstick_id && status) {
      const calstickStatus = mapWorkflowToCalstickStatus(status)
      await db
        .from("paks_pad_stick_replies")
        .update({
          calstick_status: calstickStatus,
          calstick_completed: status === "resolved",
          calstick_completed_at: status === "resolved" ? new Date().toISOString() : null,
        })
        .eq("id", stick.calstick_id)
    }

    return NextResponse.json({ workflow: stick })
  } catch (error) {
    console.error("[v0] Error in workflow PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function mapWorkflowToCalstickStatus(workflowStatus: WorkflowStatus): string {
  const mapping: Record<WorkflowStatus, string> = {
    idea: "todo",
    triage: "todo",
    in_progress: "in-progress",
    resolved: "done",
  }
  return mapping[workflowStatus]
}
