import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Types
interface ArchiveInput {
  taskIds?: string[]
  archiveAll?: boolean
}

// Constants
const DEFAULT_AUTO_ARCHIVE_DAYS = 14
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

const ARCHIVED_TASKS_SELECT = `
  *,
  stick:sticks(id, topic, content, pad:pads(id, name)),
  user:users(id, full_name, email, username, avatar_url)
`

// Archive a single task or bulk archive
export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

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

    const body: ArchiveInput = await request.json()
    const { taskIds, archiveAll } = body

    if (archiveAll) {
      const { data: userPrefs } = await db
        .from("users")
        .select("calstick_auto_archive_days")
        .eq("id", user.id)
        .maybeSingle()

      const autoArchiveDays = userPrefs?.calstick_auto_archive_days ?? DEFAULT_AUTO_ARCHIVE_DAYS
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - autoArchiveDays)

      const { data, error } = await db
        .from("calstick_tasks")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("calstick_completed", true)
        .eq("is_archived", false)
        .lt("calstick_completed_at", cutoffDate.toISOString())
        .select("id")

      if (error) throw error

      return NextResponse.json({
        success: true,
        archivedCount: data?.length ?? 0,
      })
    }

    if (taskIds?.length) {
      const { error } = await db
        .from("calstick_tasks")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .in("id", taskIds)
        .eq("user_id", user.id)

      if (error) throw error

      return NextResponse.json({ success: true, archivedCount: taskIds.length })
    }

    return NextResponse.json({ error: "No tasks specified" }, { status: 400 })
  } catch (error) {
    console.error("Archive error:", error)
    return NextResponse.json({ error: "Failed to archive tasks" }, { status: 500 })
  }
}

// Unarchive tasks
export async function DELETE(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

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

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 })
    }

    const { error } = await db
      .from("calstick_tasks")
      .update({
        is_archived: false,
        archived_at: null,
      })
      .eq("id", taskId)
      .eq("user_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unarchive error:", error)
    return NextResponse.json({ error: "Failed to unarchive task" }, { status: 500 })
  }
}

// Get archived tasks
export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

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

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") ?? String(DEFAULT_PAGE))
    const limit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT))
    const offset = (page - 1) * limit

    const { data, error } = await db
      .from("calstick_tasks")
      .select(ARCHIVED_TASKS_SELECT)
      .eq("user_id", user.id)
      .eq("is_archived", true)
      .order("archived_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Get total count with a separate query
    const { data: countData } = await db
      .from("calstick_tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_archived", true)

    const count = countData?.length ?? 0

    return NextResponse.json({
      archivedTasks: data ?? [],
      total: count,
      hasMore: count > offset + limit,
    })
  } catch (error) {
    console.error("Get archived error:", error)
    return NextResponse.json({ error: "Failed to get archived tasks" }, { status: 500 })
  }
}
