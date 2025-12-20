import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"

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

    const dailyDomain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || "stickmynote.daily.co"
    const dailyApiKey = process.env.DAILY_API_KEY

    let roomUrl = ""
    let roomName = ""

    // Try to create room via Daily.co API if API key is available
    if (dailyApiKey) {
      try {
        const response = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${dailyApiKey}`,
          },
          body: JSON.stringify({
            name: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            properties: {
              enable_screenshare: true,
              enable_chat: true,
              start_video_off: false,
              start_audio_off: false,
            },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          roomUrl = data.url
          roomName = data.name
        } else {
          console.error("Daily.co API error:", await response.text())
          // Fallback to manual URL construction
          roomName = `${Date.now()}-${Math.random().toString(36).substring(7)}`
          roomUrl = `https://${dailyDomain}/${roomName}`
        }
      } catch (error) {
        console.error("Error calling Daily.co API:", error)
        // Fallback to manual URL construction
        roomName = `${Date.now()}-${Math.random().toString(36).substring(7)}`
        roomUrl = `https://${dailyDomain}/${roomName}`
      }
    } else {
      // No API key, use manual URL construction
      roomName = `${Date.now()}-${Math.random().toString(36).substring(7)}`
      roomUrl = `https://${dailyDomain}/${roomName}`
    }

    const { data: room, error: dbError } = await db
      .from("video_rooms")
      .insert({
        name,
        room_url: roomUrl,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database insert error:", dbError)
      throw dbError
    }

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
                <a href="${roomUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Video Room</a>
                <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Or copy this link: <a href="${roomUrl}">${roomUrl}</a></p>
              </div>
            `,
          }),
        })
      } catch (emailError) {
        console.error("Error sending invitation emails:", emailError)
        // Don't fail the room creation if email fails
      }
    }

    return NextResponse.json({ room })
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

    // Verify the room belongs to the user
    const { data: room, error: fetchError } = await db
      .from("video_rooms")
      .select("*")
      .eq("id", roomId)
      .eq("created_by", user.id)
      .single()

    if (fetchError || !room) {
      console.error("Room not found or unauthorized:", fetchError)
      return NextResponse.json({ error: "Room not found or unauthorized" }, { status: 404 })
    }

    // Delete from Daily.co if API key is available
    const dailyApiKey = process.env.DAILY_API_KEY
    if (dailyApiKey && room.room_url) {
      try {
        // Extract room name from URL
        const roomName = room.room_url.split("/").pop()
        const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${dailyApiKey}`,
          },
        })

        if (!response.ok) {
          console.error("Failed to delete from Daily.co:", await response.text())
        }
      } catch (error) {
        console.error("Error deleting from Daily.co:", error)
        // Continue with database deletion even if Daily.co deletion fails
      }
    }

    const { error: deleteError } = await db
      .from("video_rooms")
      .delete()
      .eq("id", roomId)
      .eq("created_by", user.id)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting video room:", error)
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 })
  }
}
