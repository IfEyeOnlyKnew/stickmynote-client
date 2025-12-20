import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"

interface EscalationRule {
  id: string
  user_id: string
  trigger_type: string
  trigger_conditions: { hours_threshold?: number }
  cooldown_minutes: number
  max_escalations: number
}

interface ProcessingResults {
  processed: number
  escalated: number
  errors: number
}

function isValidCronRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

async function processNoReplyRule(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  rule: EscalationRule
): Promise<number> {
  const hoursThreshold = rule.trigger_conditions?.hours_threshold || 8
  const cutoffTime = new Date()
  cutoffTime.setHours(cutoffTime.getHours() - hoursThreshold)

  const { data: sticks } = await db
    .from("social_sticks")
    .select("id, user_id, topic, social_pad_id")
    .eq("user_id", rule.user_id)
    .lt("created_at", cutoffTime.toISOString())

  if (!sticks || sticks.length === 0) return 0

  const cooldownCutoff = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000).toISOString()

  const escalationChecks = await Promise.all(
    sticks.map(async (stick) => {
      const { data: existingEscalation } = await db
        .from("notification_escalations")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("entity_type", "stick")
        .eq("entity_id", stick.id)
        .gte("created_at", cooldownCutoff)
        .single()

      return { stick, shouldEscalate: !existingEscalation && rule.max_escalations > 0 }
    })
  )

  const sticksToEscalate = escalationChecks.filter((c) => c.shouldEscalate)

  if (sticksToEscalate.length === 0) return 0

  const insertData = sticksToEscalate.map(({ stick }) => ({
    rule_id: rule.id,
    user_id: rule.user_id,
    entity_type: "stick",
    entity_id: stick.id,
    status: "pending",
  }))

  await db.from("notification_escalations").insert(insertData)

  return sticksToEscalate.length
}

async function processRule(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  rule: EscalationRule
): Promise<number> {
  if (rule.trigger_type === "no_reply") {
    return processNoReplyRule(db, rule)
  }
  return 0
}

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = await createDatabaseClient()

    const { data: rules, error: rulesError } = await db
      .from("notification_escalation_rules")
      .select("*")
      .eq("is_active", true)

    if (rulesError) throw rulesError

    const results: ProcessingResults = { processed: 0, escalated: 0, errors: 0 }

    for (const rule of rules || []) {
      try {
        const escalatedCount = await processRule(db, rule as EscalationRule)
        results.escalated += escalatedCount
        results.processed++
      } catch (err) {
        console.error(`Error processing rule ${rule.id}:`, err)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in escalation cron:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
