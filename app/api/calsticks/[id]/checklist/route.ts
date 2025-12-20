import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import type { ChecklistData } from "@/types/checklist"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await createServiceDatabaseClient()
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

    const calstickId = params.id
    const body = await request.json()
    const { checklist_items } = body as { checklist_items: ChecklistData }

    // Calculate progress from checklist
    const completedItems = checklist_items.items.filter((item) => item.completed).length
    const totalItems = checklist_items.items.length
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    const { data, error } = await db
      .from("paks_pad_stick_replies")
      .update({
        calstick_checklist_items: checklist_items,
        calstick_progress: progress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", calstickId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .select()
      .maybeSingle()

    if (error) {
      console.error("Error updating checklist:", error)
      return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 })
    }

    return NextResponse.json({ calstick: data })
  } catch (error) {
    console.error("Error in checklist PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
