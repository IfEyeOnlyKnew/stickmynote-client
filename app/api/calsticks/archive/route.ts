import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { archiveTasks, unarchiveTask, getArchivedTasks } from "@/lib/handlers/calsticks-archive-handler"

// POST: Archive tasks (single or bulk)
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const result = await archiveTasks(authResult.user, body)
    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === "No tasks specified") {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Archive error:", error)
    return NextResponse.json({ error: "Failed to archive tasks" }, { status: 500 })
  }
}

// DELETE: Unarchive task
export async function DELETE(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 })
    }

    const result = await unarchiveTask(authResult.user, taskId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Unarchive error:", error)
    return NextResponse.json({ error: "Failed to unarchive task" }, { status: 500 })
  }
}

// GET: Get archived tasks
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const result = await getArchivedTasks(authResult.user, {
      page: Number.parseInt(searchParams.get("page") ?? "1"),
      limit: Number.parseInt(searchParams.get("limit") ?? "20"),
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Get archived error:", error)
    return NextResponse.json({ error: "Failed to get archived tasks" }, { status: 500 })
  }
}
