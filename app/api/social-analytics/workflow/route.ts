import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import type { WorkflowStatus } from "@/types/social-workflow"

export async function GET() {
  try {
    const supabase = await createClient()

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
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    // Get user's accessible pads
    const { data: ownedPads } = await supabase
      .from("social_pads")
      .select("id")
      .eq("owner_id", user.id)
      .eq("org_id", orgContext.orgId)

    const { data: memberPads } = await supabase
      .from("social_pad_members")
      .select("social_pad_id")
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .eq("accepted", true)

    const padIds = [...(ownedPads?.map((p) => p.id) || []), ...(memberPads?.map((m) => m.social_pad_id) || [])]

    if (padIds.length === 0) {
      return NextResponse.json(getEmptyMetrics())
    }

    // Get all sticks with workflow info
    const { data: sticks } = await supabase
      .from("social_sticks")
      .select(`
        id,
        topic,
        content,
        workflow_status,
        workflow_owner_id,
        workflow_due_date,
        workflow_updated_at,
        calstick_id,
        created_at,
        updated_at,
        social_pad_id,
        user_id,
        social_pads(name)
      `)
      .in("social_pad_id", padIds)
      .eq("org_id", orgContext.orgId)

    const allSticks = sticks || []

    // Get reply activity for stuck thread detection
    const stickIds = allSticks.map((s) => s.id)
    const { data: recentReplies } = await supabase
      .from("social_stick_replies")
      .select("social_stick_id, created_at")
      .in("social_stick_id", stickIds)
      .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

    const recentReplyStickIds = new Set(recentReplies?.map((r) => r.social_stick_id) || [])

    // Calculate metrics by status
    const byStatus: Record<WorkflowStatus, number> = {
      idea: 0,
      triage: 0,
      in_progress: 0,
      resolved: 0,
    }

    let stuckThreads = 0
    let needsOwner = 0
    let criticalUnresolved = 0
    let promotedToCalSticks = 0
    let totalResolutionTime = 0
    let resolvedCount = 0

    const now = new Date()
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    for (const stick of allSticks) {
      const status = (stick.workflow_status as WorkflowStatus) || "idea"
      byStatus[status]++

      if (stick.calstick_id) {
        promotedToCalSticks++
      }

      if (!stick.workflow_owner_id && status !== "resolved") {
        needsOwner++
      }

      // Stuck thread: not resolved, no recent replies, older than 48h
      const lastActivity = stick.workflow_updated_at || stick.updated_at || stick.created_at
      const lastActivityDate = new Date(lastActivity)
      if (status !== "resolved" && lastActivityDate < fortyEightHoursAgo && !recentReplyStickIds.has(stick.id)) {
        stuckThreads++
      }

      // Critical unresolved (in_progress for > 7 days)
      if (status === "in_progress") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const createdAt = new Date(stick.created_at)
        if (createdAt < sevenDaysAgo) {
          criticalUnresolved++
        }
      }

      // Resolution time calculation
      if (status === "resolved" && stick.workflow_updated_at) {
        const created = new Date(stick.created_at)
        const resolved = new Date(stick.workflow_updated_at)
        const hours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60)
        totalResolutionTime += hours
        resolvedCount++
      }
    }

    const avgTimeToResolution = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0

    // Get trends for last 7 days
    const trends: Array<{
      date: string
      sticksCreated: number
      resolved: number
      promotedToCalSticks: number
    }> = []

    for (let i = 6; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(now.getDate() - i)
      day.setHours(0, 0, 0, 0)

      const nextDay = new Date(day)
      nextDay.setDate(day.getDate() + 1)

      const daySticks = allSticks.filter((s) => {
        const created = new Date(s.created_at)
        return created >= day && created < nextDay
      })

      const dayResolved = allSticks.filter((s) => {
        if (s.workflow_status !== "resolved" || !s.workflow_updated_at) return false
        const resolved = new Date(s.workflow_updated_at)
        return resolved >= day && resolved < nextDay
      })

      const dayPromoted = allSticks.filter((s) => {
        if (!s.calstick_id) return false
        // Check promoted_at if available, fallback to workflow_updated_at
        const promotedDate = new Date(s.workflow_updated_at || s.created_at)
        return promotedDate >= day && promotedDate < nextDay
      })

      trends.push({
        date: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        sticksCreated: daySticks.length,
        resolved: dayResolved.length,
        promotedToCalSticks: dayPromoted.length,
      })
    }

    // Pad health metrics
    const padHealthMap = new Map<
      string,
      {
        name: string
        total: number
        byStatus: Record<WorkflowStatus, number>
        stuck: number
        needsOwner: number
      }
    >()

    for (const stick of allSticks) {
      const padId = stick.social_pad_id
      const padName = (stick.social_pads as any)?.name || "Unknown"
      const status = (stick.workflow_status as WorkflowStatus) || "idea"

      if (!padHealthMap.has(padId)) {
        padHealthMap.set(padId, {
          name: padName,
          total: 0,
          byStatus: { idea: 0, triage: 0, in_progress: 0, resolved: 0 },
          stuck: 0,
          needsOwner: 0,
        })
      }

      const padData = padHealthMap.get(padId)!
      padData.total++
      padData.byStatus[status]++

      const lastActivity = stick.workflow_updated_at || stick.updated_at || stick.created_at
      if (status !== "resolved" && new Date(lastActivity) < fortyEightHoursAgo && !recentReplyStickIds.has(stick.id)) {
        padData.stuck++
      }

      if (!stick.workflow_owner_id && status !== "resolved") {
        padData.needsOwner++
      }
    }

    const padHealth = Array.from(padHealthMap.entries())
      .map(([padId, data]) => {
        const resolvedPct = data.total > 0 ? (data.byStatus.resolved / data.total) * 100 : 0
        const stuckPct = data.total > 0 ? (data.stuck / data.total) * 100 : 0
        const healthScore = Math.max(0, Math.min(100, resolvedPct - stuckPct * 2 + 50))

        return {
          padId,
          padName: data.name,
          sticksTotal: data.total,
          sticksByStatus: data.byStatus,
          healthScore: Math.round(healthScore),
          stuckCount: data.stuck,
          needsOwnerCount: data.needsOwner,
        }
      })
      .sort((a, b) => b.sticksTotal - a.sticksTotal)

    // Attention items
    const attentionItems = {
      unanswered48h: stuckThreads,
      needsOwner: needsOwner,
      criticalUnresolved: criticalUnresolved,
      overdue: allSticks.filter((s) => {
        if (!s.workflow_due_date || s.workflow_status === "resolved") return false
        return new Date(s.workflow_due_date) < now
      }).length,
    }

    return NextResponse.json({
      metrics: {
        byStatus,
        avgTimeToResolution: Math.round(avgTimeToResolution * 10) / 10,
        stuckThreads,
        needsOwner,
        criticalUnresolved,
        promotedToCalSticks,
      },
      trends,
      padHealth,
      attentionItems,
      totalSticks: allSticks.length,
    })
  } catch (error) {
    console.error("[v0] Error fetching workflow analytics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getEmptyMetrics() {
  return {
    metrics: {
      byStatus: { idea: 0, triage: 0, in_progress: 0, resolved: 0 },
      avgTimeToResolution: 0,
      stuckThreads: 0,
      needsOwner: 0,
      criticalUnresolved: 0,
      promotedToCalSticks: 0,
    },
    trends: [],
    padHealth: [],
    attentionItems: {
      unanswered48h: 0,
      needsOwner: 0,
      criticalUnresolved: 0,
      overdue: 0,
    },
    totalSticks: 0,
  }
}
