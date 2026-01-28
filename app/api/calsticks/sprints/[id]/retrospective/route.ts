import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type {
  SprintRetrospective,
  RetrospectiveItem,
  ActionItem,
  UpdateRetrospectiveInput,
} from "@/types/sprint"

export const dynamic = "force-dynamic"

// GET - Fetch retrospective for a sprint
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [db, authResult] = await Promise.all([
      createDatabaseClient(),
      getCachedAuthUser(),
    ])

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sprintId = params.id

    // Check if retrospective exists for this sprint
    const { data: retro, error } = await db
      .from("sprint_retrospectives")
      .select(`
        *,
        sprint:sprints(id, name, goal, start_date, end_date, status)
      `)
      .eq("sprint_id", sprintId)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching retrospective:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!retro) {
      return NextResponse.json({ retrospective: null }, { status: 200 })
    }

    // Parse JSONB fields
    const retrospective: SprintRetrospective = {
      ...retro,
      went_well: retro.went_well || [],
      to_improve: retro.to_improve || [],
      action_items: retro.action_items || [],
      participants: retro.participants || [],
    }

    return NextResponse.json({ retrospective })
  } catch (error) {
    console.error("Error in GET retrospective:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST - Create a new retrospective for a sprint
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [db, authResult] = await Promise.all([
      createDatabaseClient(),
      getCachedAuthUser(),
    ])

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sprintId = params.id
    const body = await request.json()
    const orgContext = await getOrgContext()

    // Check if sprint exists
    const { data: sprint, error: sprintError } = await db
      .from("sprints")
      .select("id, org_id, name")
      .eq("id", sprintId)
      .single()

    if (sprintError || !sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    // Check if retrospective already exists
    const { data: existing } = await db
      .from("sprint_retrospectives")
      .select("id")
      .eq("sprint_id", sprintId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "Retrospective already exists for this sprint" },
        { status: 409 }
      )
    }

    // Create new retrospective
    const newRetro = {
      sprint_id: sprintId,
      org_id: sprint.org_id || orgContext?.orgId,
      went_well: [],
      to_improve: [],
      action_items: [],
      facilitator_id: body.facilitator_id || authResult.user.id,
      meeting_date: body.meeting_date || new Date().toISOString(),
      meeting_notes: body.meeting_notes || "",
      participants: [authResult.user.id],
      status: "draft" as const,
      created_by: authResult.user.id,
    }

    const { data: retro, error } = await db
      .from("sprint_retrospectives")
      .insert(newRetro)
      .select()
      .single()

    if (error) {
      console.error("Error creating retrospective:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ retrospective: retro }, { status: 201 })
  } catch (error) {
    console.error("Error in POST retrospective:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH - Update retrospective
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [db, authResult] = await Promise.all([
      createDatabaseClient(),
      getCachedAuthUser(),
    ])

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sprintId = params.id
    const body: UpdateRetrospectiveInput = await request.json()

    // Get existing retrospective
    const { data: existing, error: fetchError } = await db
      .from("sprint_retrospectives")
      .select("*")
      .eq("sprint_id", sprintId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Retrospective not found" },
        { status: 404 }
      )
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.went_well !== undefined) updates.went_well = body.went_well
    if (body.to_improve !== undefined) updates.to_improve = body.to_improve
    if (body.action_items !== undefined) updates.action_items = body.action_items
    if (body.meeting_notes !== undefined) updates.meeting_notes = body.meeting_notes
    if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes
    if (body.team_mood_score !== undefined) updates.team_mood_score = body.team_mood_score

    // Handle participants - add current user if not already included
    if (body.participants !== undefined) {
      updates.participants = body.participants
    } else {
      const currentParticipants = existing.participants || []
      if (!currentParticipants.includes(authResult.user.id)) {
        updates.participants = [...currentParticipants, authResult.user.id]
      }
    }

    // Handle status change
    if (body.status !== undefined) {
      updates.status = body.status
      if (body.status === "completed" && !existing.completed_at) {
        updates.completed_at = new Date().toISOString()
      }
    }

    const { data: retro, error } = await db
      .from("sprint_retrospectives")
      .update(updates)
      .eq("sprint_id", sprintId)
      .select()
      .single()

    if (error) {
      console.error("Error updating retrospective:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ retrospective: retro })
  } catch (error) {
    console.error("Error in PATCH retrospective:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE - Delete retrospective
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [db, authResult] = await Promise.all([
      createDatabaseClient(),
      getCachedAuthUser(),
    ])

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sprintId = params.id

    const { error } = await db
      .from("sprint_retrospectives")
      .delete()
      .eq("sprint_id", sprintId)

    if (error) {
      console.error("Error deleting retrospective:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE retrospective:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
