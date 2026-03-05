import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Map DB column names to front-end interface names
function mapDependency(row: Record<string, unknown>) {
  return {
    id: row.id,
    calstick_id: row.task_id,
    depends_on_calstick_id: row.depends_on_id,
    dependency_type: row.dependency_type || "FS",
    lag_days: row.lag_days || 0,
    created_at: row.created_at,
  }
}

// POST - Fetch dependencies for given task IDs
export async function POST(req: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let taskIds: string[]
    try {
      const body = await req.json()
      taskIds = body.taskIds
    } catch (parseError) {
      console.error("[dependencies] Parse error:", parseError)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ dependencies: [] })
    }

    const { data: dependencies, error } = await db
      .from("calstick_dependencies")
      .select("*")
      .in("task_id", taskIds)

    if (error) {
      return NextResponse.json({ error: "Failed to fetch dependencies", details: error.message }, { status: 500 })
    }

    const mapped = (dependencies || []).map(mapDependency)
    return NextResponse.json({ dependencies: mapped })
  } catch (error) {
    console.error("[dependencies] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// PUT - Create a new dependency
export async function PUT(req: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { calstick_id, depends_on_calstick_id, dependency_type = "FS", lag_days = 0 } = body

    if (!calstick_id || !depends_on_calstick_id) {
      return NextResponse.json({ error: "calstick_id and depends_on_calstick_id are required" }, { status: 400 })
    }

    if (calstick_id === depends_on_calstick_id) {
      return NextResponse.json({ error: "A task cannot depend on itself" }, { status: 400 })
    }

    const validTypes = ["FS", "SS", "FF", "SF", "blocks", "relates_to", "duplicates"]
    if (!validTypes.includes(dependency_type)) {
      return NextResponse.json({ error: `Invalid dependency_type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 })
    }

    // Check for duplicate
    const { data: existing } = await db
      .from("calstick_dependencies")
      .select("id")
      .eq("task_id", calstick_id)
      .eq("depends_on_id", depends_on_calstick_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "This dependency already exists" }, { status: 409 })
    }

    const { data: dependency, error } = await db
      .from("calstick_dependencies")
      .insert({
        task_id: calstick_id,
        depends_on_id: depends_on_calstick_id,
        dependency_type,
        lag_days: Number(lag_days) || 0,
      })
      .select()
      .single()

    if (error) {
      console.error("[dependencies] Create error:", error)
      return NextResponse.json({ error: "Failed to create dependency", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ dependency: mapDependency(dependency) }, { status: 201 })
  } catch (error) {
    console.error("[dependencies] PUT error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// DELETE - Remove a dependency
export async function DELETE(req: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const { error } = await db
      .from("calstick_dependencies")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[dependencies] Delete error:", error)
      return NextResponse.json({ error: "Failed to delete dependency", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[dependencies] DELETE error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
