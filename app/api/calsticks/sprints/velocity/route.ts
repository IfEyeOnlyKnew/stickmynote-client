import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type { VelocityTrend, SprintVelocity } from "@/types/sprint"

export const dynamic = "force-dynamic"

// GET: Get velocity trend data for completed sprints
export async function GET(request: NextRequest) {
  try {
    const [db, authResult] = await Promise.all([
      createDatabaseClient(),
      getCachedAuthUser(),
    ])

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

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "10", 10)

    // Fetch completed sprints
    const { data: sprints, error } = await db
      .from("sprints")
      .select("id, name, velocity_planned, velocity_completed, start_date, end_date")
      .eq("org_id", orgContext.orgId)
      .eq("status", "completed")
      .order("end_date", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[velocity] Query error:", error)
      return NextResponse.json({ error: "Failed to fetch velocity data" }, { status: 500 })
    }

    if (!sprints || sprints.length === 0) {
      return NextResponse.json({
        sprints: [],
        averageVelocity: 0,
        trend: "stable",
      } as VelocityTrend)
    }

    // If velocity_completed is not stored, calculate from tasks
    const sprintIds = sprints.map((s: any) => s.id)
    const { data: taskData } = await db
      .from("paks_pad_stick_replies")
      .select("sprint_id, story_points, calstick_completed")
      .in("sprint_id", sprintIds)
      .eq("is_calstick", true)
      .eq("calstick_completed", true)

    // Calculate completed points per sprint
    const completedPointsMap: Record<string, number> = {}
    for (const task of taskData || []) {
      if (task.sprint_id) {
        completedPointsMap[task.sprint_id] = (completedPointsMap[task.sprint_id] || 0) + (task.story_points || 0)
      }
    }

    const sprintVelocities: SprintVelocity[] = sprints.map((sprint: any) => ({
      sprintId: sprint.id,
      sprintName: sprint.name,
      plannedPoints: sprint.velocity_planned || 0,
      completedPoints: sprint.velocity_completed || completedPointsMap[sprint.id] || 0,
      startDate: sprint.start_date,
      endDate: sprint.end_date,
    }))

    // Calculate average velocity
    const totalCompleted = sprintVelocities.reduce((sum, s) => sum + s.completedPoints, 0)
    const averageVelocity = sprintVelocities.length > 0 ? Math.round(totalCompleted / sprintVelocities.length) : 0

    // Determine trend (comparing first half vs second half of sprints)
    let trend: "increasing" | "decreasing" | "stable" = "stable"
    if (sprintVelocities.length >= 4) {
      const halfIndex = Math.floor(sprintVelocities.length / 2)
      // Note: sprints are ordered desc, so recent ones are first
      const recentAvg = sprintVelocities.slice(0, halfIndex).reduce((sum, s) => sum + s.completedPoints, 0) / halfIndex
      const olderAvg = sprintVelocities.slice(halfIndex).reduce((sum, s) => sum + s.completedPoints, 0) / (sprintVelocities.length - halfIndex)

      const diff = recentAvg - olderAvg
      const threshold = averageVelocity * 0.1 // 10% threshold

      if (diff > threshold) {
        trend = "increasing"
      } else if (diff < -threshold) {
        trend = "decreasing"
      }
    }

    const velocityTrend: VelocityTrend = {
      sprints: sprintVelocities.toReversed(), // Return chronological order
      averageVelocity,
      trend,
    }

    return NextResponse.json(velocityTrend)
  } catch (error) {
    console.error("[velocity] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
