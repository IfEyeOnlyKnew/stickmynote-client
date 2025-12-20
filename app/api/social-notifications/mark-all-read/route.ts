import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { getOrgContext } from "@/lib/auth/get-org-context"

// POST /api/social-notifications/mark-all-read - Mark all social notifications as read
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = session.user

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }

    // Get pads where user is a member
    const memberPadsResult = await db.query(
      `SELECT social_pad_id FROM social_pad_members WHERE user_id = $1`,
      [user.id]
    )

    // Get pads owned by user
    const ownedPadsResult = await db.query(
      `SELECT id FROM social_pads WHERE owner_id = $1 AND org_id = $2`,
      [user.id, orgContext.orgId]
    )

    const padIds = [
      ...memberPadsResult.rows.map((m: any) => m.social_pad_id),
      ...ownedPadsResult.rows.map((p: any) => p.id),
    ]

    if (padIds.length === 0) {
      return NextResponse.json({ success: true })
    }

    // Get recent stick activities in user's pads (not by user)
    const stickActivitiesResult = await db.query(
      `SELECT id FROM social_sticks 
       WHERE social_pad_id = ANY($1) 
       AND org_id = $2 
       AND user_id <> $3 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [padIds, orgContext.orgId, user.id]
    )
    const stickActivities = stickActivitiesResult.rows

    // Get recent reply activities
    const replyActivitiesResult = await db.query(
      `SELECT r.id, s.social_pad_id, s.user_id as stick_owner_id
       FROM social_stick_replies r
       JOIN social_sticks s ON r.stick_id = s.id
       WHERE r.org_id = $1 
       AND r.user_id <> $2
       ORDER BY r.created_at DESC 
       LIMIT 50`,
      [orgContext.orgId, user.id]
    )

    // Filter replies to only those in user's pads or on user's sticks
    const filteredReplies = replyActivitiesResult.rows.filter((reply: any) => {
      return padIds.includes(reply.social_pad_id) || reply.stick_owner_id === user.id
    })

    // Create notification keys for all activities
    const notificationKeys = [
      ...stickActivities.map((stick: any) => `stick_${stick.id}`),
      ...filteredReplies.map((reply: any) => `reply_${reply.id}`),
    ]

    if (notificationKeys.length === 0) {
      return NextResponse.json({ success: true })
    }

    // Batch upsert all as read
    const now = new Date().toISOString()
    
    // Build upsert query for batch insert
    const values: any[] = []
    const placeholders: string[] = []
    notificationKeys.forEach((key, i) => {
      const baseIndex = i * 3
      placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`)
      values.push(user.id, key, now)
    })

    await db.query(
      `INSERT INTO social_notification_reads (user_id, notification_key, last_read_at)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (user_id, notification_key) 
       DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      values
    )

    return NextResponse.json({ success: true, marked: notificationKeys.length })
  } catch (error) {
    console.error("[v0] Error in mark-all-read POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
