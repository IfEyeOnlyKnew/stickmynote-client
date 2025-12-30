import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import type { WorkflowStatus } from "@/types/social-workflow"

interface StickData {
  id: string
  topic: string
  content: string
  workflow_status: string
  workflow_owner_id: string | null
  workflow_due_date: string | null
  workflow_updated_at: string | null
  calstick_id: string | null
  created_at: string
  updated_at: string
  social_pad_id: string
  user_id: string
  social_pads: { name: string } | null
}

interface StickMetrics {
  byStatus: Record<WorkflowStatus, number>
  stuckThreads: number
  needsOwner: number
  criticalUnresolved: number
  promotedToCalSticks: number
  totalResolutionTime: number
  resolvedCount: number
}

interface PadHealthData {
  name: string
  total: number
  byStatus: Record<WorkflowStatus, number>
  stuck: number
  needsOwner: number
}

function createEmptyStatusRecord(): Record<WorkflowStatus, number> {
  return { idea: 0, triage: 0, in_progress: 0, resolved: 0 }
}

function isStuckThread(
  stick: StickData,
  status: WorkflowStatus,
  fortyEightHoursAgo: Date,
  recentReplyStickIds: Set<string>
): boolean {
  if (status === "resolved") return false
  const lastActivity = stick.workflow_updated_at || stick.updated_at || stick.created_at
  return new Date(lastActivity) < fortyEightHoursAgo && !recentReplyStickIds.has(stick.id)
}

function isCriticalUnresolved(stick: StickData, status: WorkflowStatus, now: Date): boolean {
  if (status !== "in_progress") return false
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return new Date(stick.created_at) < sevenDaysAgo
}

function calculateResolutionTime(stick: StickData, status: WorkflowStatus): number | null {
  if (status !== "resolved" || !stick.workflow_updated_at) return null
  const created = new Date(stick.created_at)
  const resolved = new Date(stick.workflow_updated_at)
  return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60)
}

function calculateStickMetrics(
  allSticks: StickData[],
  recentReplyStickIds: Set<string>,
  now: Date,
  fortyEightHoursAgo: Date
): StickMetrics {
  const metrics: StickMetrics = {
    byStatus: createEmptyStatusRecord(),
    stuckThreads: 0,
    needsOwner: 0,
    criticalUnresolved: 0,
    promotedToCalSticks: 0,
    totalResolutionTime: 0,
    resolvedCount: 0,
  }

  for (const stick of allSticks) {
    const status = (stick.workflow_status as WorkflowStatus) || "idea"
    metrics.byStatus[status]++

    if (stick.calstick_id) metrics.promotedToCalSticks++
    if (!stick.workflow_owner_id && status !== "resolved") metrics.needsOwner++
    if (isStuckThread(stick, status, fortyEightHoursAgo, recentReplyStickIds)) metrics.stuckThreads++
    if (isCriticalUnresolved(stick, status, now)) metrics.criticalUnresolved++

    const resolutionTime = calculateResolutionTime(stick, status)
    if (resolutionTime !== null) {
      metrics.totalResolutionTime += resolutionTime
      metrics.resolvedCount++
    }
  }

  return metrics
}

function calculateTrends(allSticks: StickData[], now: Date) {
  return Array.from({ length: 7 }, (_, idx) => {
    const i = 6 - idx
    const day = new Date(now)
    day.setDate(now.getDate() - i)
    day.setHours(0, 0, 0, 0)
    const nextDay = new Date(day)
    nextDay.setDate(day.getDate() + 1)

    const isInRange = (dateStr: string) => {
      const d = new Date(dateStr)
      return d >= day && d < nextDay
    }

    return {
      date: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      sticksCreated: allSticks.filter((s) => isInRange(s.created_at)).length,
      resolved: allSticks.filter(
        (s) => s.workflow_status === "resolved" && s.workflow_updated_at && isInRange(s.workflow_updated_at)
      ).length,
      promotedToCalSticks: allSticks.filter(
        (s) => s.calstick_id && isInRange(s.workflow_updated_at || s.created_at)
      ).length,
    }
  })
}

function calculatePadHealth(
  allSticks: StickData[],
  recentReplyStickIds: Set<string>,
  fortyEightHoursAgo: Date
) {
  const padHealthMap = new Map<string, PadHealthData>()

  for (const stick of allSticks) {
    const padId = stick.social_pad_id
    const padName = (stick.social_pads as any)?.name || "Unknown"
    const status = (stick.workflow_status as WorkflowStatus) || "idea"

    if (!padHealthMap.has(padId)) {
      padHealthMap.set(padId, {
        name: padName,
        total: 0,
        byStatus: createEmptyStatusRecord(),
        stuck: 0,
        needsOwner: 0,
      })
    }

    const padData = padHealthMap.get(padId)!
    padData.total++
    padData.byStatus[status]++

    if (isStuckThread(stick, status, fortyEightHoursAgo, recentReplyStickIds)) padData.stuck++
    if (!stick.workflow_owner_id && status !== "resolved") padData.needsOwner++
  }

  return Array.from(padHealthMap.entries())
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
}

function getEmptyMetrics() {
  return {
    metrics: {
      byStatus: createEmptyStatusRecord(),
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

export async function GET() {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const db = await createDatabaseClient()
    const user = authResult.user

    const [{ data: ownedPads }, { data: memberPads }] = await Promise.all([
      db.from("social_pads").select("id").eq("owner_id", user.id).eq("org_id", orgContext.orgId),
      db.from("social_pad_members").select("social_pad_id").eq("user_id", user.id).eq("org_id", orgContext.orgId).eq("accepted", true),
    ])

    const padIds = [...(ownedPads?.map((p) => p.id) || []), ...(memberPads?.map((m) => m.social_pad_id) || [])]
    if (padIds.length === 0) {
      return NextResponse.json(getEmptyMetrics())
    }

    const { data: sticks } = await db
      .from("social_sticks")
      .select("id, topic, content, workflow_status, workflow_owner_id, workflow_due_date, workflow_updated_at, calstick_id, created_at, updated_at, social_pad_id, user_id")
      .in("social_pad_id", padIds)
      .eq("org_id", orgContext.orgId)

    // Fetch pad names separately
    const uniquePadIds = [...new Set((sticks || []).map((s: any) => s.social_pad_id).filter(Boolean))]
    let padNameMap = new Map<string, string>()
    if (uniquePadIds.length > 0) {
      const { data: pads } = await db
        .from("social_pads")
        .select("id, name")
        .in("id", uniquePadIds)
      for (const p of pads || []) {
        padNameMap.set(p.id, p.name)
      }
    }

    // Attach pad names to sticks
    const allSticks = ((sticks || []) as any[]).map((s) => ({
      ...s,
      social_pads: s.social_pad_id ? { name: padNameMap.get(s.social_pad_id) } : null,
    })) as StickData[]
    const stickIds = allSticks.map((s) => s.id)

    const { data: recentReplies } = await db
      .from("social_stick_replies")
      .select("social_stick_id, created_at")
      .in("social_stick_id", stickIds)
      .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

    const recentReplyStickIds = new Set<string>(recentReplies?.map((r) => r.social_stick_id) || [])
    const now = new Date()
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    const metrics = calculateStickMetrics(allSticks, recentReplyStickIds, now, fortyEightHoursAgo)
    const avgTimeToResolution = metrics.resolvedCount > 0 ? metrics.totalResolutionTime / metrics.resolvedCount : 0
    const trends = calculateTrends(allSticks, now)
    const padHealth = calculatePadHealth(allSticks, recentReplyStickIds, fortyEightHoursAgo)

    const attentionItems = {
      unanswered48h: metrics.stuckThreads,
      needsOwner: metrics.needsOwner,
      criticalUnresolved: metrics.criticalUnresolved,
      overdue: allSticks.filter((s) => s.workflow_due_date && s.workflow_status !== "resolved" && new Date(s.workflow_due_date) < now).length,
    }

    return NextResponse.json({
      metrics: {
        byStatus: metrics.byStatus,
        avgTimeToResolution: Math.round(avgTimeToResolution * 10) / 10,
        stuckThreads: metrics.stuckThreads,
        needsOwner: metrics.needsOwner,
        criticalUnresolved: metrics.criticalUnresolved,
        promotedToCalSticks: metrics.promotedToCalSticks,
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
