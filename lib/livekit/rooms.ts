import "server-only"
import { RoomServiceClient } from "livekit-server-sdk"
import { db } from "@/lib/database/pg-client"

function getLiveKitUrl(): string {
  const url = process.env.LIVEKIT_URL
  if (!url) throw new Error("LIVEKIT_URL must be set")
  // RoomServiceClient needs HTTP(S) URL, not WebSocket
  return url.replace(/^ws:/, "http:").replace(/^wss:/, "https:")
}

function getRoomServiceClient(): RoomServiceClient {
  return new RoomServiceClient(
    getLiveKitUrl(),
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
  )
}

/**
 * Generate a unique room name for LiveKit
 */
function generateRoomName(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Creates a video room on LiveKit and stores it in the database.
 * Shared between the video rooms API and the meetings API.
 */
export async function createVideoRoom(
  name: string,
  userId: string,
  siteUrl?: string,
): Promise<{ id: string; room_url: string; livekit_room_name: string }> {
  const livekitRoomName = generateRoomName()
  const client = getRoomServiceClient()

  // Create room on LiveKit server (auto_create is true by default,
  // but explicit creation lets us set max_participants)
  try {
    await client.createRoom({
      name: livekitRoomName,
      emptyTimeout: 300, // 5 minutes after last participant leaves
      maxParticipants: 10,
    })
  } catch (error) {
    console.error("[LiveKit] Error creating room on server:", error)
    // Continue — LiveKit auto-creates rooms on join, so this is non-fatal
  }

  // Insert into database
  const result = await db.query(
    `INSERT INTO video_rooms (name, room_url, livekit_room_name, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, "", livekitRoomName, userId],
  )

  const room = result.rows[0]

  // Set room_url to our app's join page
  const baseUrl = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://stickmynote.com"
  const roomUrl = `${baseUrl}/video/join/${room.id}`

  await db.query(`UPDATE video_rooms SET room_url = $1 WHERE id = $2`, [roomUrl, room.id])

  return {
    id: room.id,
    room_url: roomUrl,
    livekit_room_name: livekitRoomName,
  }
}

/**
 * Deletes a video room from LiveKit and the database.
 */
export async function deleteVideoRoom(roomId: string, userId: string): Promise<void> {
  // Get the room to find the LiveKit room name
  const result = await db.query(
    `SELECT * FROM video_rooms WHERE id = $1 AND created_by = $2`,
    [roomId, userId],
  )

  const room = result.rows[0]
  if (!room) {
    throw new Error("Room not found or unauthorized")
  }

  // Delete from LiveKit server
  if (room.livekit_room_name) {
    try {
      const client = getRoomServiceClient()
      await client.deleteRoom(room.livekit_room_name)
    } catch (error) {
      console.error("[LiveKit] Error deleting room from server:", error)
      // Continue with database deletion
    }
  }

  // Delete from database
  await db.query(
    `DELETE FROM video_rooms WHERE id = $1 AND created_by = $2`,
    [roomId, userId],
  )
}
