import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type {
  SprintRetrospective,
  UpdateRetrospectiveInput,
} from "@/types/sprint"

export const dynamic = "force-dynamic"

// ============================================================================
// Auth guard
// ============================================================================

interface RetroAuthContext {
  db: any
  userId: string
}

async function authenticateRetroRequest(): Promise<{ auth: RetroAuthContext } | { error: NextResponse }> {
  const [db, authResult] = await Promise.all([
    createDatabaseClient(),
    getCachedAuthUser(),
  ])

  if (authResult.rateLimited) {
    return { error: NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }) }
  }
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  return { auth: { db, userId: authResult.user.id } }
}

// ============================================================================
// Helpers
// ============================================================================

function buildRetroUpdates(body: UpdateRetrospectiveInput, existing: any, userId: string): Record<string, unknown> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const copyFields: (keyof UpdateRetrospectiveInput)[] = [
    "went_well", "to_improve", "action_items",
    "meeting_notes", "duration_minutes", "team_mood_score",
  ]

  for (const field of copyFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  // Handle participants - add current user if not already included
  if (body.participants === undefined) {
    const currentParticipants = existing.participants || []
    if (!currentParticipants.includes(userId)) {
      updates.participants = [...currentParticipants, userId]
    }
  } else {
    updates.participants = body.participants
  }

  // Handle status change
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === "completed" && !existing.completed_at) {
      updates.completed_at = new Date().toISOString()
    }
  }

  return updates
}

// ============================================================================
// GET - Fetch retrospective for a sprint
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await authenticateRetroRequest()
    if ("error" in result) return result.error
    const { db } = result.auth

    const sprintId = params.id

    const { data: retro, error } = await db
      .from("sprint_retrospectives")
      .select(`
        *,
        sprint:sprints(id, name, goal, start_date, end_date, status)
      `)
      .eq("sprint_id", sprintId)
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching retrospective:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!retro) {
      return NextResponse.json({ retrospective: null }, { status: 200 })
    }

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST - Create a new retrospective for a sprint
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await authenticateRetroRequest()
    if ("error" in result) return result.error
    const { db, userId } = result.auth

    const sprintId = params.id
    const body = await request.json()
    const orgContext = await getOrgContext()

    const { data: sprint, error: sprintError } = await db
      .from("sprints")
      .select("id, org_id, name")
      .eq("id", sprintId)
      .single()

    if (sprintError || !sprint) {
      return NextResponse.json({ error: "Sprint not found" }, { status: 404 })
    }

    const { data: existing } = await db
      .from("sprint_retrospectives")
      .select("id")
      .eq("sprint_id", sprintId)
      .single()

    if (existing) {
      return NextResponse.json({ error: "Retrospective already exists for this sprint" }, { status: 409 })
    }

    const { data: retro, error } = await db
      .from("sprint_retrospectives")
      .insert({
        sprint_id: sprintId,
        org_id: sprint.org_id || orgContext?.orgId,
        went_well: [],
        to_improve: [],
        action_items: [],
        facilitator_id: body.facilitator_id || userId,
        meeting_date: body.meeting_date || new Date().toISOString(),
        meeting_notes: body.meeting_notes || "",
        participants: [userId],
        status: "draft" as const,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating retrospective:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ retrospective: retro }, { status: 201 })
  } catch (error) {
    console.error("Error in POST retrospective:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PATCH - Update retrospective
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await authenticateRetroRequest()
    if ("error" in result) return result.error
    const { db, userId } = result.auth

    const sprintId = params.id
    const body: UpdateRetrospectiveInput = await request.json()

    const { data: existing, error: fetchError } = await db
      .from("sprint_retrospectives")
      .select("*")
      .eq("sprint_id", sprintId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Retrospective not found" }, { status: 404 })
    }

    const updates = buildRetroUpdates(body, existing, userId)

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// DELETE - Delete retrospective
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await authenticateRetroRequest()
    if ("error" in result) return result.error
    const { db } = result.auth

    const { error } = await db
      .from("sprint_retrospectives")
      .delete()
      .eq("sprint_id", params.id)

    if (error) {
      console.error("Error deleting retrospective:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE retrospective:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
