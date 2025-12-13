import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)
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
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ dependencies: [] })
    }

    const { data: dependencies, error } = await supabase
      .from("calstick_dependencies")
      .select("*")
      .in("task_id", taskIds)

    if (error) {
      return NextResponse.json({ error: "Failed to fetch dependencies", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ dependencies: dependencies || [] })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
