import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import type { TaskProgress } from "@/types/checklist"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServer()
    const authResult = await getCachedAuthUser(supabase)

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

    const calstickId = params.id

    const { data: parentTask, error: parentError } = await supabase
      .from("paks_pad_stick_replies")
      .select("calstick_checklist_items, calstick_progress, org_id")
      .eq("id", calstickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (parentError) {
      console.error("Error fetching parent task:", parentError)
      return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 })
    }

    if (!parentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const { data: subtasks, error: subtasksError } = await supabase
      .from("paks_pad_stick_replies")
      .select("calstick_completed")
      .eq("calstick_parent_id", calstickId)
      .eq("org_id", orgContext.orgId)
      .eq("is_calstick", true)

    if (subtasksError) {
      console.error("Error fetching subtasks:", subtasksError)
      return NextResponse.json({ error: "Failed to fetch subtasks" }, { status: 500 })
    }

    // Calculate checklist progress
    const checklistData = parentTask.calstick_checklist_items as { items: any[] } | null
    const checklistItems = checklistData?.items || []
    const completedChecklistItems = checklistItems.filter((item) => item.completed).length
    const checklistPercentage = checklistItems.length > 0 ? (completedChecklistItems / checklistItems.length) * 100 : 0

    // Calculate subtasks progress
    const totalSubtasks = subtasks?.length || 0
    const completedSubtasks = subtasks?.filter((st: any) => st.calstick_completed).length || 0
    const subtasksPercentage = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

    // Calculate overall progress (average of checklist and subtasks)
    let overall = 0
    if (checklistItems.length > 0 && totalSubtasks > 0) {
      overall = (checklistPercentage + subtasksPercentage) / 2
    } else if (checklistItems.length > 0) {
      overall = checklistPercentage
    } else if (totalSubtasks > 0) {
      overall = subtasksPercentage
    }

    const progress: TaskProgress = {
      checklist: {
        total: checklistItems.length,
        completed: completedChecklistItems,
        percentage: Math.round(checklistPercentage),
      },
      subtasks: {
        total: totalSubtasks,
        completed: completedSubtasks,
        percentage: Math.round(subtasksPercentage),
      },
      overall: Math.round(overall),
    }

    return NextResponse.json({ progress })
  } catch (error) {
    console.error("Error calculating progress:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
