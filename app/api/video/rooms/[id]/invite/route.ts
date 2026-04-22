import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db } from "@/lib/database/pg-client"
import {
  addRoomParticipants,
  notifyInvitees,
  type Invitee,
} from "@/lib/livekit/participants"

export const dynamic = "force-dynamic"

async function sendInviteEmails(
  emails: string[],
  roomName: string,
  roomUrl: string,
  userProfile: { email?: string; username?: string } | null,
): Promise<void> {
  if (emails.length === 0) return
  const inviter = userProfile?.username || userProfile?.email || "a user"
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: emails,
        subject: `You're invited to join "${roomName}" video room`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Video Room Invitation</h2>
            <p>You've been invited by <strong>${inviter}</strong> to join a video conference.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Room: ${roomName}</h3>
              <p style="margin-bottom: 0;">Click the button below to join:</p>
            </div>
            <a href="${roomUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Video Room</a>
          </div>
        `,
      }),
    })
  } catch (err) {
    console.error("[video invite] email send failed:", err)
  }
}

function normaliseInvitees(body: unknown): Invitee[] {
  if (!body || typeof body !== "object") return []
  const b = body as { invitees?: unknown }
  if (!Array.isArray(b.invitees)) return []
  return b.invitees
    .filter(
      (i): i is { userId?: string | null; email: string } =>
        !!i && typeof i === "object" && typeof (i as { email?: unknown }).email === "string",
    )
    .map((i) => ({ userId: i.userId ?? null, email: i.email }))
}

// POST /api/video/rooms/:id/invite — add more participants to an existing room
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roomId } = await params
    const dbClient = await createDatabaseClient()
    const {
      data: { user },
    } = await dbClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only the room creator can add invitees
    const roomResult = await db.query<{
      id: string
      name: string
      room_url: string
      created_by: string
    }>(
      `SELECT id, name, room_url, created_by FROM video_rooms WHERE id = $1`,
      [roomId],
    )
    const room = roomResult.rows[0]
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }
    if (room.created_by !== user.id) {
      return NextResponse.json({ error: "Only the room creator can add participants" }, { status: 403 })
    }

    const body = await request.json()
    const invitees = normaliseInvitees(body)
    if (invitees.length === 0) {
      return NextResponse.json({ error: "No invitees provided" }, { status: 400 })
    }

    const { data: userProfile } = await dbClient
      .from("users")
      .select("email, username, full_name")
      .eq("id", user.id)
      .single()

    const { createdUserIds } = await addRoomParticipants(roomId, user.id, invitees)

    const emails = invitees.map((i) => i.email).filter(Boolean)
    await sendInviteEmails(emails, room.name, room.room_url, userProfile)

    if (createdUserIds.length > 0) {
      const inviterName =
        userProfile?.full_name || userProfile?.username || userProfile?.email || "A user"
      const orgContext = await getOrgContext()
      await notifyInvitees(
        createdUserIds,
        {
          roomId: room.id,
          roomName: room.name,
          roomUrl: room.room_url,
          invitedBy: { id: user.id, name: inviterName },
        },
        orgContext?.orgId ?? null,
      )
    }

    return NextResponse.json({
      added: createdUserIds.length,
      emailed: emails.length,
    })
  } catch (error) {
    console.error("[video invite] error:", error)
    return NextResponse.json({ error: "Failed to add invitees" }, { status: 500 })
  }
}
