import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

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

    return NextResponse.json({ dependencies: dependencies || [] })
  } catch (error) {
    console.error("[dependencies] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
