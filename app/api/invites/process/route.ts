import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const user = session.user
    const userEmail = user.email
    if (!userEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 })
    }

    // Process organization invites
    const orgInvitesResult = await db.query(
      `SELECT id, org_id, role, invited_by FROM organization_invites WHERE email = $1 AND status = 'pending'`,
      [userEmail.toLowerCase()]
    )
    const orgInvites = orgInvitesResult.rows
    const processedOrgInvites: string[] = []
    for (const invite of orgInvites) {
      // Check if already a member
      const existingMemberResult = await db.query(
        `SELECT id FROM organization_members WHERE org_id = $1 AND user_id = $2`,
        [invite.org_id, user.id]
      )
      if (existingMemberResult.rows.length > 0) {
        // Already a member, just mark invite as accepted
        await db.query(
          `UPDATE organization_invites SET status = 'accepted' WHERE id = $1`,
          [invite.id]
        )
        continue
      }
      // Create organization membership
      await db.query(
        `INSERT INTO organization_members (org_id, user_id, role, invited_by, joined_at) VALUES ($1, $2, $3, $4, $5)`,
        [invite.org_id, user.id, invite.role, invite.invited_by, new Date().toISOString()]
      )
      // Mark invite as accepted
      await db.query(
        `UPDATE organization_invites SET status = 'accepted' WHERE id = $1`,
        [invite.id]
      )
      processedOrgInvites.push(invite.org_id)
    }

    // Process pad invites
    const padInvitesResult = await db.query(
      `SELECT pad_id, role FROM paks_pad_pending_invites WHERE email = $1`,
      [userEmail]
    )
    const padInvites = padInvitesResult.rows
    const processedPadInvites: string[] = []
    for (const invite of padInvites) {
      // Create pad membership
      await db.query(
        `INSERT INTO paks_pad_members (pad_id, user_id, role, accepted, joined_at) VALUES ($1, $2, $3, $4, $5)`,
        [invite.pad_id, user.id, invite.role, true, new Date().toISOString()]
      )
      // Delete the pending invite
      await db.query(
        `DELETE FROM paks_pad_pending_invites WHERE pad_id = $1 AND email = $2`,
        [invite.pad_id, userEmail]
      )
      processedPadInvites.push(invite.pad_id)
    }

    return NextResponse.json({
      success: true,
      processedOrgInvites,
      processedPadInvites,
    })
  } catch (error) {
    console.error("[v0] Error processing invites:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
