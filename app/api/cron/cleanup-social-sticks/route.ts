import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"

// This cron job runs daily to apply cleanup policies to social sticks
// Configure in vercel.json: { "path": "/api/cron/cleanup-social-sticks", "schedule": "0 2 * * *" }

export const dynamic = "force-dynamic"

interface CleanupPolicy {
  id: string
  social_pad_id: string
  auto_archive_enabled: boolean
  archive_after_days: number | null
  auto_delete_enabled: boolean
  delete_archived_after_days: number | null
  auto_close_resolved_enabled: boolean
  close_resolved_after_days: number | null
  max_sticks_per_pad: number | null
  exempt_pinned_sticks: boolean
  exempt_workflow_active: boolean
}

interface CleanupResults {
  archived: number
  deleted: number
  closed: number
  errors: string[]
}

function calculateCutoffDate(now: Date, days: number): Date {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  return cutoff
}

function addError(results: CleanupResults, action: string, padId: string, message: string): void {
  results.errors.push(`${action} error for pad ${padId}: ${message}`)
}

async function archiveInactiveSticks(
  db: DatabaseClient,
  policy: CleanupPolicy,
  now: Date,
  results: CleanupResults,
): Promise<void> {
  if (!policy.auto_archive_enabled || !policy.archive_after_days) return

  const archiveCutoff = calculateCutoffDate(now, policy.archive_after_days)

  let archiveQuery = db
    .from("social_sticks")
    .update({
      is_archived: true,
      archived_at: now.toISOString(),
    })
    .eq("social_pad_id", policy.social_pad_id)
    .eq("is_archived", false)
    .lt("updated_at", archiveCutoff.toISOString())

  if (policy.exempt_pinned_sticks) {
    archiveQuery = archiveQuery.eq("is_pinned", false)
  }

  if (policy.exempt_workflow_active) {
    archiveQuery = archiveQuery.or(
      "workflow_status.is.null,workflow_status.eq.closed,workflow_status.eq.resolved",
    )
  }

  const { data: archived, error } = await archiveQuery.select("id")

  if (error) {
    addError(results, "Archive", policy.social_pad_id, error.message)
  } else if (archived) {
    results.archived += archived.length
  }
}

async function deleteArchivedSticks(
  db: DatabaseClient,
  policy: CleanupPolicy,
  now: Date,
  results: CleanupResults,
): Promise<void> {
  if (!policy.auto_delete_enabled || !policy.delete_archived_after_days) return

  const deleteCutoff = calculateCutoffDate(now, policy.delete_archived_after_days)

  const { data: deleted, error } = await db
    .from("social_sticks")
    .delete()
    .eq("social_pad_id", policy.social_pad_id)
    .eq("is_archived", true)
    .lt("archived_at", deleteCutoff.toISOString())
    .select("id")

  if (error) {
    addError(results, "Delete", policy.social_pad_id, error.message)
  } else if (deleted) {
    results.deleted += deleted.length
  }
}

async function closeResolvedSticks(
  db: DatabaseClient,
  policy: CleanupPolicy,
  now: Date,
  results: CleanupResults,
): Promise<void> {
  if (!policy.auto_close_resolved_enabled || !policy.close_resolved_after_days) return

  const closeCutoff = calculateCutoffDate(now, policy.close_resolved_after_days)

  const { data: closed, error } = await db
    .from("social_sticks")
    .update({
      is_archived: true,
      archived_at: now.toISOString(),
      workflow_status: "closed",
    })
    .eq("social_pad_id", policy.social_pad_id)
    .eq("workflow_status", "resolved")
    .eq("is_archived", false)
    .lt("workflow_updated_at", closeCutoff.toISOString())
    .select("id")

  if (error) {
    addError(results, "Close", policy.social_pad_id, error.message)
  } else if (closed) {
    results.closed += closed.length
  }
}

async function enforceMaxSticks(
  db: DatabaseClient,
  policy: CleanupPolicy,
  now: Date,
  results: CleanupResults,
): Promise<void> {
  if (!policy.max_sticks_per_pad) return

  const { count } = await db
    .from("social_sticks")
    .select("id", { count: "exact", head: true })
    .eq("social_pad_id", policy.social_pad_id)
    .eq("is_archived", false)

  if (!count || count <= policy.max_sticks_per_pad) return

  const excess = count - policy.max_sticks_per_pad

  let excessQuery = db
    .from("social_sticks")
    .select("id")
    .eq("social_pad_id", policy.social_pad_id)
    .eq("is_archived", false)
    .order("created_at", { ascending: true })
    .limit(excess)

  if (policy.exempt_pinned_sticks) {
    excessQuery = excessQuery.eq("is_pinned", false)
  }

  const { data: excessSticks } = await excessQuery

  if (!excessSticks?.length) return

  const ids = excessSticks.map((s) => s.id)
  const { error } = await db
    .from("social_sticks")
    .update({
      is_archived: true,
      archived_at: now.toISOString(),
    })
    .in("id", ids)

  if (error) {
    addError(results, "Max sticks archive", policy.social_pad_id, error.message)
  } else {
    results.archived += ids.length
  }
}

async function applyPolicy(
  db: DatabaseClient,
  policy: CleanupPolicy,
  now: Date,
  results: CleanupResults,
): Promise<void> {
  await archiveInactiveSticks(db, policy, now, results)
  await deleteArchivedSticks(db, policy, now, results)
  await closeResolvedSticks(db, policy, now, results)
  await enforceMaxSticks(db, policy, now, results)
}

function buildResultMessage(results: CleanupResults): string {
  return `Cleanup completed: ${results.archived} archived, ${results.deleted} deleted, ${results.closed} closed`
}

export async function GET() {
  const db = await createServiceDatabaseClient()
  const results: CleanupResults = { archived: 0, deleted: 0, closed: 0, errors: [] }

  try {
    const { data: policies, error: policiesError } = await db
      .from("social_pad_cleanup_policies")
      .select("*")

    if (policiesError) {
      return NextResponse.json({ error: policiesError.message }, { status: 500 })
    }

    if (!policies?.length) {
      return NextResponse.json({ message: "No cleanup policies configured", results })
    }

    const now = new Date()

    for (const policy of policies as CleanupPolicy[]) {
      try {
        await applyPolicy(db, policy, now, results)
      } catch (policyError) {
        results.errors.push(`Policy ${policy.id} error: ${String(policyError)}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: buildResultMessage(results),
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Cleanup job failed", details: String(error) },
      { status: 500 },
    )
  }
}
