import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { checkDLPPolicy } from "@/lib/dlp/policy-checker"
import { createVideoRoom, deleteVideoRoom } from "@/lib/livekit/rooms"

export const dynamic = "force-dynamic"

// GET - Fetch all rooms for the current user
export async function GET() {
  try {
    const db = await createDatabaseClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: rooms, error } = await db
      .from("video_rooms")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error:", error)
      throw error
    }

    return NextResponse.json({ rooms: rooms || [] })
  } catch (error) {
    console.error("Error fetching video rooms:", error)
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 })
  }
}

// POST - Create a new video room
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
    const { name, inviteEmails = [] } = body

    if (!name) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 })
    }

    const { data: userProfile } = await db.from("users").select("email, username").eq("id", user.id).single()

    // DLP check for external video invites
    if (inviteEmails.length > 0) {
      const orgContext = await getOrgContext()
      if (orgContext) {
        for (const email of inviteEmails) {
          const dlpResult = await checkDLPPolicy({
            orgId: orgContext.orgId,
            action: "invite_external",
            userId: user.id,
            targetEmail: email,
          })
          if (!dlpResult.allowed) {
            return NextResponse.json({ error: dlpResult.reason }, { status: 403 })
          }
        }
      }
    }

    // Create room via LiveKit
    const room = await createVideoRoom(name, user.id)

    // Send invitation emails if provided
    if (inviteEmails.length > 0) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: inviteEmails,
            subject: `You're invited to join "${name}" video room`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Video Room Invitation</h2>
                <p>You've been invited by <strong>${userProfile?.username || userProfile?.email || "a user"}</strong> to join a video conference.</p>
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Room: ${name}</h3>
                  <p style="margin-bottom: 0;">Click the button below to join:</p>
                </div>
                <a href="${room.room_url}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Video Room</a>
                <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Or copy this link: <a href="${room.room_url}">${room.room_url}</a></p>
              </div>
            `,
          }),
        })
      } catch (emailError) {
        console.error("Error sending invitation emails:", emailError)
      }
    }

    return NextResponse.json({ room: { id: room.id, room_url: room.room_url, name, livekit_room_name: room.livekit_room_name } })
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
