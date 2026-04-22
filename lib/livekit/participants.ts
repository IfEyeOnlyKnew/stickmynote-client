import "server-only"
import { db } from "@/lib/database/pg-client"
import { publishToUsers } from "@/lib/ws/publish-event"

export interface Invitee {
  userId: string | null
  email: string
}

export interface VideoRoomRow {
  id: string
  name: string
  room_url: string
  created_by: string
  multi_pak_id: string | null
  pad_id: string | null
  livekit_room_name: string | null
  created_at: string
  updated_at: string
}

export interface VideoRoomWithRole extends VideoRoomRow {
  role: "owner" | "invitee"
  participant_status?: string | null
}

interface ExistingParticipants {
  userIds: Set<string>
  emails: Set<string>
}

async function fetchExistingParticipants(
  roomId: string,
  userIds: string[],
  emails: string[],
): Promise<ExistingParticipants> {
  const existing = await db.query<{ user_id: string | null; email: string | null }>(
    `SELECT user_id, LOWER(email) AS email
       FROM video_room_participants
      WHERE room_id = $1
        AND (user_id = ANY($2::uuid[]) OR LOWER(email) = ANY($3::text[]))`,
    [roomId, userIds, emails],
  )
  return {
    userIds: new Set(existing.rows.map((r) => r.user_id).filter((v): v is string => !!v)),
    emails: new Set(existing.rows.map((r) => r.email).filter((v): v is string => !!v)),
  }
}

async function insertInvitee(
  roomId: string,
  invitedBy: string,
  invitee: Invitee,
  existing: ExistingParticipants,
): Promise<string | null> {
  if (invitee.userId) {
    if (existing.userIds.has(invitee.userId)) return null
    await db.query(
      `INSERT INTO video_room_participants (room_id, user_id, email, invited_by)
       VALUES ($1, $2, $3, $4)`,
      [roomId, invitee.userId, invitee.email || null, invitedBy],
    )
    return invitee.userId
  }
  if (invitee.email && !existing.emails.has(invitee.email.toLowerCase())) {
    await db.query(
      `INSERT INTO video_room_participants (room_id, email, invited_by)
       VALUES ($1, $2, $3)`,
      [roomId, invitee.email, invitedBy],
    )
  }
  return null
}

/**
 * Insert participant rows for a newly-invited set of users.
 * De-dupes against existing participants before inserting, so repeated
 * invites for the same room are a no-op.
 * Returns the user IDs that were newly added — callers use this to
 * decide who to broadcast WebSocket events to.
 */
export async function addRoomParticipants(
  roomId: string,
  invitedBy: string,
  invitees: Invitee[],
): Promise<{ createdUserIds: string[] }> {
  const cleaned = invitees.filter(
    (i) => (i.userId && i.userId !== invitedBy) || (i.email && i.email.length > 0),
  )
  if (cleaned.length === 0) return { createdUserIds: [] }

  const userIds = cleaned.map((i) => i.userId).filter((u): u is string => !!u)
  const emails = cleaned
    .filter((i) => !i.userId && i.email)
    .map((i) => i.email.toLowerCase())

  const existing = await fetchExistingParticipants(roomId, userIds, emails)
  const createdUserIds: string[] = []

  for (const invitee of cleaned) {
    try {
      const createdId = await insertInvitee(roomId, invitedBy, invitee, existing)
      if (createdId) createdUserIds.push(createdId)
    } catch (err) {
      console.error("[video participants] Insert failed:", err)
    }
  }

  return { createdUserIds }
}

/**
 * Fetch all rooms the user can see: rooms they created, plus rooms
 * they've been invited to (where they haven't declined/left).
 */
export async function listRoomsForUser(userId: string): Promise<VideoRoomWithRole[]> {
  const result = await db.query<VideoRoomWithRole>(
    `SELECT vr.*, 'owner'::text AS role, NULL::text AS participant_status
       FROM video_rooms vr
      WHERE vr.created_by = $1
      UNION ALL
     SELECT vr.*, 'invitee'::text AS role, vrp.status AS participant_status
       FROM video_rooms vr
       JOIN video_room_participants vrp ON vrp.room_id = vr.id
      WHERE vrp.user_id = $1
        AND vr.created_by <> $1
        AND vrp.status IN ('invited', 'joined')
      ORDER BY created_at DESC`,
    [userId],
  )
  return result.rows
}

export interface VideoInvitePayload {
  roomId: string
  roomName: string
  roomUrl: string
  invitedBy: {
    id: string
    name: string
  }
}

/**
 * Persist a bell-visible notification row for each invitee. Offline users
 * see these when they next open the app; online users receive a live toast
 * via the WebSocket event below.
 */
async function persistInviteNotifications(
  userIds: string[],
  orgId: string,
  payload: VideoInvitePayload,
): Promise<void> {
  for (const userId of userIds) {
    try {
      await db.query(
        `INSERT INTO notifications (
            user_id, org_id, type, title, message,
            related_id, related_type, action_url,
            created_by, metadata
         ) VALUES ($1, $2, 'video_call_invite', $3, $4, $5, 'video_room', $6, $7, $8)`,
        [
          userId,
          orgId,
          `${payload.invitedBy.name} invited you to a video call`,
          `Join "${payload.roomName}"`,
          payload.roomId,
          payload.roomUrl,
          payload.invitedBy.id,
          JSON.stringify({
            roomId: payload.roomId,
            roomName: payload.roomName,
            roomUrl: payload.roomUrl,
          }),
        ],
      )
    } catch (err) {
      // Don't block the invite flow on notification persistence issues
      console.error("[video participants] notification insert failed:", err)
    }
  }
}

/**
 * Notify invitees: persist a bell row (if we have an org context) AND push
 * a live WebSocket event. Fire-and-forget — failures don't block the invite.
 */
export async function notifyInvitees(
  userIds: string[],
  payload: VideoInvitePayload,
  orgId?: string | null,
): Promise<void> {
  if (userIds.length === 0) return

  if (orgId) {
    await persistInviteNotifications(userIds, orgId, payload)
  }

  await publishToUsers(userIds, {
    type: "video_invite",
    payload,
    timestamp: Date.now(),
  })
}
