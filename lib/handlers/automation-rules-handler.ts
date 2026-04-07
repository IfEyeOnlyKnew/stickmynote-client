// Shared handler logic for automation rules (v1 + v2 deduplication)
import { NextResponse } from "next/server"
import { query, querySingle } from "@/lib/database/pg-helpers"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

// Shared auth + org guard
async function getAuthAndOrg(): Promise<
  { error: NextResponse } | { user: { id: string; email?: string }; orgId: string }
> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    }
  }
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: NextResponse.json({ error: "No organization context" }, { status: 403 }) }
  }

  return { user: authResult.user, orgId: orgContext.orgId }
}

// GET - List user's automation rules
export async function handleGetAutomationRules(): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const rules = await query(
      `SELECT * FROM automation_rules
       WHERE user_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [auth.user.id, auth.orgId],
    )

    return NextResponse.json({ rules })
  } catch (error) {
    console.error("[rules GET] Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// POST - Create automation rule
export async function handleCreateAutomationRule(request: Request): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const body = await request.json()
    const { name, trigger_type, trigger_config, action_type, action_config, is_active = true } = body

    if (!name || !trigger_type || !action_type) {
      return NextResponse.json(
        { error: "name, trigger_type, and action_type are required" },
        { status: 400 },
      )
    }

    const rule = await querySingle(
      `INSERT INTO automation_rules (user_id, org_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        auth.user.id,
        auth.orgId,
        name,
        trigger_type,
        JSON.stringify(trigger_config || {}),
        action_type,
        JSON.stringify(action_config || {}),
        is_active,
      ],
    )

    return NextResponse.json({ rule })
  } catch (error) {
    console.error("Create rule error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
