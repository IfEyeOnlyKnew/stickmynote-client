import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db } from "@/lib/database/pg-client"

const PM_DEFAULTS = {
  timesheets_retention_years: 7,
  invoices_retention_years: 7,
  budgets_retention_years: 5,
  portfolio_retention_years: 10,
  goals_retention_years: 3,
  auto_archive_paid_invoices_days: 90,
  auto_archive_completed_goals_days: 90,
  auto_purge_draft_entries_days: 0,
  default_billable: true,
  default_hourly_rate_cents: 0,
  require_time_approval: false,
  fiscal_year_start_month: 1,
}

export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const result = await db.query(
      `SELECT settings FROM organizations WHERE id = $1`,
      [orgContext.orgId]
    )

    const orgSettings = result.rows[0]?.settings || {}

    const pmSettings: Record<string, any> = {}
    for (const [key, defaultVal] of Object.entries(PM_DEFAULTS)) {
      pmSettings[key] = orgSettings[`pm_${key}`] === undefined ? defaultVal : orgSettings[`pm_${key}`]
    }

    return NextResponse.json({ settings: pmSettings, defaults: PM_DEFAULTS })
  } catch (error) {
    console.error("[pm/settings GET] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    if (!["owner", "admin"].includes(orgContext.role || "")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const allowedKeys = Object.keys(PM_DEFAULTS)

    const updates: Record<string, any> = {}
    for (const [key, value] of Object.entries(body)) {
      if (allowedKeys.includes(key)) {
        updates[`pm_${key}`] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid settings provided" }, { status: 400 })
    }

    await db.query(
      `UPDATE organizations
       SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb,
           updated_at = now()
       WHERE id = $2`,
      [JSON.stringify(updates), orgContext.orgId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[pm/settings PATCH] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
