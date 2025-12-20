import { redirect } from "next/navigation"
import { PadPageClient } from "./page-client"
import { getSession } from "@/lib/auth/local-auth"
import { createDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import type { Pad, Stick } from "@/types/pad"

// Types
interface SessionUser {
  id: string
  email?: string
}

interface PadPageData {
  pad: Pad
  sticks: Stick[]
  user: SessionUser
  userRole: string | null
}

// Constants
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

const ROLE_MAP: Record<string, string> = {
  edit: "editor",
  view: "viewer",
  admin: "admin",
  editor: "editor",
  viewer: "viewer",
  owner: "owner",
}

// Helper functions
function mapRole(dbRole: string): string {
  return ROLE_MAP[dbRole.toLowerCase()] || dbRole
}

async function processPendingInvites(
  db: DatabaseClient,
  padId: string,
  userId: string,
  userEmail: string,
): Promise<void> {
  const { data: pendingInvites } = await db
    .from("paks_pad_pending_invites")
    .select("*")
    .eq("pad_id", padId)
    .eq("email", userEmail)

  if (!pendingInvites?.length) return

  console.log("[v0] Found pending pad invite for user, auto-accepting...")

  for (const invite of pendingInvites) {
    const { error: memberError } = await db.from("paks_pad_members").insert({
      pad_id: invite.pad_id,
      user_id: userId,
      role: invite.role,
      accepted: true,
      joined_at: new Date().toISOString(),
    })

    if (memberError) {
      console.error("[v0] Error auto-accepting pad invite:", memberError)
      continue
    }

    await db.from("paks_pad_pending_invites").delete().eq("id", invite.id)
    console.log("[v0] Auto-accepted pad invite successfully")
  }
}

async function acceptUnacceptedMemberships(
  db: DatabaseClient,
  padId: string,
  userId: string,
): Promise<void> {
  const { data: unacceptedMembers, error } = await db
    .from("paks_pad_members")
    .select("*")
    .eq("pad_id", padId)
    .eq("user_id", userId)
    .eq("accepted", false)

  if (error || !unacceptedMembers?.length) return

  console.log("[v0] Found unaccepted pad membership, auto-accepting...")

  for (const member of unacceptedMembers) {
    const { error: acceptError } = await db
      .from("paks_pad_members")
      .update({
        accepted: true,
        joined_at: new Date().toISOString(),
      })
      .eq("id", member.id)

    if (acceptError) {
      console.error("[v0] Error auto-accepting pad membership:", acceptError)
    } else {
      console.log("[v0] Auto-accepted pad membership successfully")
    }
  }
}

async function fetchPad(db: DatabaseClient, padId: string): Promise<Pad | null> {
  const { data: pad, error } = await db
    .from("paks_pads")
    .select("*")
    .eq("id", padId)
    .single()

  if (error || !pad) return null
  return pad as Pad
}

async function fetchUserMembership(
  db: DatabaseClient,
  padId: string,
  userId: string,
): Promise<{ role: string } | null> {
  const { data } = await db
    .from("paks_pad_members")
    .select("role")
    .eq("pad_id", padId)
    .eq("user_id", userId)
    .eq("accepted", true)
    .maybeSingle()

  return data
}

function determineUserRole(isPadOwner: boolean, membership: { role: string } | null): string | null {
  if (isPadOwner) return "admin"
  if (membership?.role) return mapRole(membership.role)
  return null
}

async function fetchSticksWithRetry(db: DatabaseClient, padId: string): Promise<Stick[]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await db
        .from("paks_pad_sticks")
        .select("*")
        .eq("pad_id", padId)
        .order("created_at", { ascending: false })

      if (!error) return (data || []) as Stick[]

      console.error(`Error fetching sticks (attempt ${attempt}):`, error)

      const isRateLimited = error.message?.includes("Too Many") || error.code === "429"
      if (!isRateLimited || attempt === MAX_RETRIES) break

      console.log(`Rate limited, waiting ${attempt * RETRY_DELAY_MS}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, attempt * RETRY_DELAY_MS))
    } catch (error) {
      console.error(`Unexpected error fetching sticks (attempt ${attempt}):`, error)
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * RETRY_DELAY_MS))
      }
    }
  }

  console.error("Failed to fetch sticks after retries, returning empty array")
  return []
}

async function getPadWithSticks(padId: string): Promise<PadPageData> {
  const session = await getSession()

  if (!session) {
    redirect("/auth/login")
  }

  const db = await createDatabaseClient()
  const user = session.user

  // Auto-accept pending invites and memberships
  if (user.email) {
    await processPendingInvites(db, padId, user.id, user.email)
    await acceptUnacceptedMemberships(db, padId, user.id)
  }

  // Fetch pad
  const pad = await fetchPad(db, padId)
  if (!pad) {
    redirect("/mypads")
  }

  // Determine user role
  const isPadOwner = pad.owner_id === user.id
  const membership = await fetchUserMembership(db, padId, user.id)
  const userRole = determineUserRole(isPadOwner, membership)

  // Verify access
  if (!userRole && !isPadOwner && !membership) {
    redirect("/mypads")
  }

  // Fetch sticks
  const sticks = await fetchSticksWithRetry(db, padId)

  return { pad, sticks, user, userRole }
}

export default async function PadPage({ params }: Readonly<{ params: { padId: string } }>) {
  const { pad, sticks, userRole } = await getPadWithSticks(params.padId)

  return <PadPageClient pad={pad} sticks={sticks} userRole={userRole} />
}
