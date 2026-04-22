import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { checkDLPPolicy } from "@/lib/dlp/policy-checker"
import { createVideoRoom, deleteVideoRoom } from "@/lib/livekit/rooms"
import {
  addRoomParticipants,
  listRoomsForUser,
  notifyInvitees,
  type Invitee,
} from "@/lib/livekit/participants"

export const dynamic = "force-dynamic"

async function checkInviteDLP(inviteEmails: string[], userId: string): Promise<NextResponse | null> {
  if (inviteEmails.length === 0) return null
  const orgContext = await getOrgContext()
  if (!orgContext) return null

  for (const email of inviteEmails) {
    const dlpResult = await checkDLPPolicy({
      orgId: orgContext.orgId,
      action: "invite_external",
      userId,
      targetEmail: email,
    })
    if (!dlpResult.allowed) {
      return NextResponse.json({ error: dlpResult.reason }, { status: 403 })
    }
  }
  return null
}

async function sendInviteEmails(
  emails: string[], roomName: string, roomUrl: string,
  userProfile: { email?: string; username?: string } | null,
): Promise<void> {
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
            <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Or copy this link: <a href="${roomUrl}">${roomUrl}</a></p>
          </div>
        `,
      }),
    })
  } catch (emailError) {
    console.error("Error sending invitation emails:", emailError)
  }
}

/**
 * Normalise the request body to a canonical invitees list.
 * Accepts either new-style `invitees: [{userId, email}]` or
 * legacy `inviteEmails: string[]` for back-compat.
 */
function normaliseInvitees(body: {
  invitees?: Invitee[]
  inviteEmails?: string[]
}): Invitee[] {
  if (Array.isArray(body.invitees) && body.invitees.length > 0) {
    return body.invitees
      .filter((i) => i && typeof i.email === "string")
      .map((i) => ({ userId: i.userId ?? null, email: i.email }))
  }
  if (Array.isArray(body.inviteEmails)) {
    return body.inviteEmails
      .filter((e): e is string => typeof e === "string" && e.length > 0)
      .map((email) => ({ userId: null, email }))
  }
  return []
}

// GET - Fetch all rooms the user owns OR has been invited to
export async function GET() {
  try {
    const db = await createDatabaseClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rooms = await listRoomsForUser(user.id)
    return NextResponse.json({ rooms })
  } catch (error) {
    console.error("Error fetching video rooms:", error)
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 })
  }
}

// POST - Create a new video room and invite participants
export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body
    const invitees = normaliseInvitees(body)

    if (!name) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 })
    }

    const { data: userProfile } = await db
      .from("users")
      .select("email, username, full_name")
      .eq("id", user.id)
      .single()

    const inviteEmails = invitees.map((i) => i.email).filter(Boolean)
    const dlpBlock = await checkInviteDLP(inviteEmails, user.id)
    if (dlpBlock) return dlpBlock

    const room = await createVideoRoom(name, user.id)

    const { createdUserIds } = await addRoomParticipants(room.id, user.id, invitees)

    if (inviteEmails.length > 0) {
      await sendInviteEmails(inviteEmails, name, room.room_url, userProfile)
    }

    if (createdUserIds.length > 0) {
      const inviterName =
        userProfile?.full_name || userProfile?.username || userProfile?.email || "A user"
      const orgContext = await getOrgContext()
      await notifyInvitees(
        createdUserIds,
        {
          roomId: room.id,
          roomName: name,
          roomUrl: room.room_url,
          invitedBy: { id: user.id, name: inviterName },
        },
        orgContext?.orgId ?? null,
      )
    }

    return NextResponse.json({
      room: {
        id: room.id,
        room_url: room.room_url,
        name,
        livekit_room_name: room.livekit_room_name,
      },
    })
  } catch (error) {
    console.error("Error creating video room:", error)
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 })
  }
}

// DELETE - Delete a video room
export async function DELETE(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("id")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 })
    }

    await deleteVideoRoom(roomId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting video room:", error)
    if ((error as Error).message === "Room not found or unauthorized") {
      return NextResponse.json({ error: "Room not found or unauthorized" }, { status: 404 })
    }
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 })
  }
}
