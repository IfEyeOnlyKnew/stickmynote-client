import "server-only"
import { AccessToken } from "livekit-server-sdk"

/**
 * Creates a LiveKit access token for a participant to join a room.
 * Must only be called server-side (API routes).
 */
export async function createLiveKitToken(
  roomName: string,
  participantIdentity: string,
  participantName: string,
): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set")
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: "6h",
  })

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  return await at.toJwt()
}
