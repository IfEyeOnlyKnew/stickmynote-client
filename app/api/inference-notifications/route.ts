import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getInferenceNotifications } from "@/lib/handlers/inference-notifications-handler"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = session.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "25", 10), 1), 100)
    const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0", 10), 0)
    // Over-fetch to have enough rows after merge/sort
    const sqlLimit = offset + limit + 1

    const notifications = await getInferenceNotifications(user.id, orgContext.orgId, { sqlLimit })

    const hasMore = notifications.length > offset + limit
    return NextResponse.json({
      notifications: notifications.slice(offset, offset + limit),
      hasMore,
    })
  } catch (error) {
    console.error("[v0] Error in inference notifications route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
