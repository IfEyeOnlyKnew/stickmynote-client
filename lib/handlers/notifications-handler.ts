// Shared handler logic for notifications (v1 + v2 deduplication)
import { NextResponse } from "next/server"
import { query, querySingle } from "@/lib/database/pg-helpers"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { publishToUser } from "@/lib/ws/publish-event"

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

// GET - Fetch user notifications
// Returns rows shaped to match the client's NotificationWithUser type.
// `is_read` column is aliased to `read` so the client receives the field
// it expects without any further transformation.
export async function handleGetNotifications(request: Request): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const unreadOnly = searchParams.get("unread") === "true"

    const whereClauses = [`n.user_id = $1`, `n.org_id = $2`]
    const params: any[] = [auth.user.id, auth.orgId]

    if (unreadOnly) {
      whereClauses.push(`n.is_read = false`)
    }

    params.push(limit)

    const queryStr = `
      SELECT
        n.id,
        n.user_id,
        n.type,
        n.title,
        n.message,
        n.related_id,
        n.related_type,
        n.action_url,
        n.is_read AS read,
        n.created_at,
        n.created_by,
        n.metadata,
        CASE WHEN u.id IS NULL THEN NULL ELSE
          jsonb_build_object(
            'full_name', u.full_name,
            'email',     u.email,
            'avatar_url', u.avatar_url
          )
        END AS created_by_user
      FROM notifications n
      LEFT JOIN users u ON u.id = n.created_by
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY n.created_at DESC
      LIMIT $${params.length}
    `

    const notifications = await query(queryStr, params)

    return NextResponse.json({ notifications: notifications || [] })
  } catch (error) {
    console.error("Error in notifications GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a notification (system use)
export async function handleCreateNotification(request: Request): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const body = await request.json()
    const { user_id, type, title, message, related_id, related_type, action_url, metadata } = body

    if (!user_id || !type || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const notification = await querySingle(
      `INSERT INTO notifications (user_id, type, title, message, related_id, related_type, action_url, created_by, metadata, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [user_id, type, title, message, related_id, related_type, action_url, auth.user.id, JSON.stringify(metadata || {}), auth.orgId],
    )

    // Push real-time event to the notification recipient
    publishToUser(user_id, {
      type: "notification.new",
      payload: notification,
      timestamp: Date.now(),
    })

    return NextResponse.json({ notification })
  } catch (error) {
    console.error("Error in notifications POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
