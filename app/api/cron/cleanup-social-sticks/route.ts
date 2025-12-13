import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// This cron job runs daily to apply cleanup policies to social sticks
// Configure in vercel.json: { "path": "/api/cron/cleanup-social-sticks", "schedule": "0 2 * * *" }

export async function GET() {
  // Use service role for admin access
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const results = {
    archived: 0,
    deleted: 0,
    closed: 0,
    errors: [] as string[],
  }

  try {
    // Get all active cleanup policies
    const { data: policies, error: policiesError } = await supabase.from("social_pad_cleanup_policies").select("*")

    if (policiesError) {
      return NextResponse.json({ error: policiesError.message }, { status: 500 })
    }

    if (!policies || policies.length === 0) {
      return NextResponse.json({ message: "No cleanup policies configured", results })
    }

    const now = new Date()

    for (const policy of policies) {
      try {
        // 1. Auto-archive inactive sticks
        if (policy.auto_archive_enabled && policy.archive_after_days) {
          const archiveCutoff = new Date(now)
          archiveCutoff.setDate(archiveCutoff.getDate() - policy.archive_after_days)

          let archiveQuery = supabase
            .from("social_sticks")
            .update({
              is_archived: true,
              archived_at: now.toISOString(),
            })
            .eq("social_pad_id", policy.social_pad_id)
            .eq("is_archived", false)
            .lt("updated_at", archiveCutoff.toISOString())

          // Exempt pinned sticks if configured
          if (policy.exempt_pinned_sticks) {
            archiveQuery = archiveQuery.eq("is_pinned", false)
          }

          // Exempt active workflow sticks if configured
          if (policy.exempt_workflow_active) {
            archiveQuery = archiveQuery.or(
              "workflow_status.is.null,workflow_status.eq.closed,workflow_status.eq.resolved",
            )
          }

          const { data: archived, error: archiveError } = await archiveQuery.select("id")

          if (archiveError) {
            results.errors.push(`Archive error for pad ${policy.social_pad_id}: ${archiveError.message}`)
          } else if (archived) {
            results.archived += archived.length
          }
        }

        // 2. Auto-delete old archived sticks
        if (policy.auto_delete_enabled && policy.delete_archived_after_days) {
          const deleteCutoff = new Date(now)
          deleteCutoff.setDate(deleteCutoff.getDate() - policy.delete_archived_after_days)

          const { data: deleted, error: deleteError } = await supabase
            .from("social_sticks")
            .delete()
            .eq("social_pad_id", policy.social_pad_id)
            .eq("is_archived", true)
            .lt("archived_at", deleteCutoff.toISOString())
            .select("id")

          if (deleteError) {
            results.errors.push(`Delete error for pad ${policy.social_pad_id}: ${deleteError.message}`)
          } else if (deleted) {
            results.deleted += deleted.length
          }
        }

        // 3. Auto-close resolved workflow sticks
        if (policy.auto_close_resolved_enabled && policy.close_resolved_after_days) {
          const closeCutoff = new Date(now)
          closeCutoff.setDate(closeCutoff.getDate() - policy.close_resolved_after_days)

          const { data: closed, error: closeError } = await supabase
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

          if (closeError) {
            results.errors.push(`Close error for pad ${policy.social_pad_id}: ${closeError.message}`)
          } else if (closed) {
            results.closed += closed.length
          }
        }

        // 4. Enforce max sticks per pad (archive oldest)
        if (policy.max_sticks_per_pad) {
          const { count } = await supabase
            .from("social_sticks")
            .select("id", { count: "exact", head: true })
            .eq("social_pad_id", policy.social_pad_id)
            .eq("is_archived", false)

          if (count && count > policy.max_sticks_per_pad) {
            const excess = count - policy.max_sticks_per_pad

            // Get oldest non-pinned sticks
            let excessQuery = supabase
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

            if (excessSticks && excessSticks.length > 0) {
              const ids = excessSticks.map((s) => s.id)
              const { error: archiveExcessError } = await supabase
                .from("social_sticks")
                .update({
                  is_archived: true,
                  archived_at: now.toISOString(),
                })
                .in("id", ids)

              if (archiveExcessError) {
                results.errors.push(
                  `Max sticks archive error for pad ${policy.social_pad_id}: ${archiveExcessError.message}`,
                )
              } else {
                results.archived += ids.length
              }
            }
          }
        }
      } catch (policyError) {
        results.errors.push(`Policy ${policy.id} error: ${String(policyError)}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${results.archived} archived, ${results.deleted} deleted, ${results.closed} closed`,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cleanup job failed",
        details: String(error),
      },
      { status: 500 },
    )
  }
}
