import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params
    const { newOwnerEmail } = await request.json()

    if (!newOwnerEmail?.trim()) {
      return NextResponse.json({ error: "New owner email is required" }, { status: 400 })
    }

    const normalizedEmail = newOwnerEmail.trim().toLowerCase()

    // Verify current user is the owner
    const ownerCheck = await db.query(
      `SELECT role FROM organization_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, session.user.id]
    )

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== "owner") {
      return NextResponse.json(
        { error: "Only the current owner can transfer ownership" },
        { status: 403 }
      )
    }

    // Find the new owner by email
    const newOwnerResult = await db.query(
      `SELECT id, email, full_name FROM users WHERE LOWER(email) = $1`,
      [normalizedEmail]
    )

    if (newOwnerResult.rows.length === 0) {
      return NextResponse.json(
        { error: "User with this email not found. They must have an account first." },
        { status: 404 }
      )
    }

    const newOwner = newOwnerResult.rows[0]

    // Check if the new owner is already a member
    const memberCheck = await db.query(
      `SELECT id, role FROM organization_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, newOwner.id]
    )

    // Start transaction
    await db.query("BEGIN")

    try {
      if (memberCheck.rows.length === 0) {
        // Add new owner as member with owner role
        await db.query(
          `INSERT INTO organization_members (org_id, user_id, role, joined_at)
           VALUES ($1, $2, 'owner', NOW())`,
          [orgId, newOwner.id]
        )
      } else {
        // Update existing member to owner
        await db.query(
          `UPDATE organization_members SET role = 'owner' WHERE org_id = $1 AND user_id = $2`,
          [orgId, newOwner.id]
        )
      }

      // Demote current owner to admin
      await db.query(
        `UPDATE organization_members SET role = 'admin' WHERE org_id = $1 AND user_id = $2`,
        [orgId, session.user.id]
      )

      // Update organization owner_id if the column exists
      await db.query(
        `UPDATE organizations SET owner_id = $1, updated_at = NOW() WHERE id = $2`,
        [newOwner.id, orgId]
      )

      await db.query("COMMIT")

      return NextResponse.json({
        success: true,
        message: `Ownership transferred to ${newOwner.email}`,
        newOwner: {
          id: newOwner.id,
          email: newOwner.email,
          full_name: newOwner.full_name,
        },
      })
    } catch (txError) {
      await db.query("ROLLBACK")
      throw txError
    }
  } catch (error) {
    console.error("[API] Error transferring ownership:", error)
    return NextResponse.json(
      { error: "Failed to transfer ownership" },
      { status: 500 }
    )
  }
}
