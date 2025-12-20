import { createDatabaseClient } from "@/lib/database/database-adapter"

export interface StickWithRole {
  id: string
  topic: string
  content: string
  color: string
  user_id: string
  pad_id: string | null
  created_at: string
  updated_at: string
  userRole: "owner" | "admin" | "edit" | "view"
  pad_name?: string
  owner_id: string
}

export async function fetchUserSticks(userId: string): Promise<StickWithRole[]> {
  const db = await createDatabaseClient()

  await db.auth.getUser()

  const { data: ownedSticks, error: ownedError } = await db
    .from("paks_pad_sticks")
    .select(`
      id, topic, content, color, user_id, pad_id, created_at, updated_at,
      paks_pads(name)
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  const { data: padMemberships, error: padMemberError } = await db
    .from("paks_pad_members")
    .select("role, accepted, pad_id, paks_pads(id, name)")
    .eq("user_id", userId)
    .eq("accepted", true)

  const { data: stickMemberships, error: stickMemberError } = await db
    .from("paks_pad_stick_members")
    .select(`
      role,
      stick_id,
      paks_pad_sticks(
        id, topic, content, color, user_id, pad_id, created_at, updated_at,
        paks_pads(name)
      )
    `)
    .eq("user_id", userId)

  if (ownedError && padMemberError && stickMemberError) {
    console.error("Failed to fetch sticks:", { ownedError, padMemberError, stickMemberError })
    return []
  }

  const memberPadIds = (padMemberships || []).map((pm: any) => pm.pad_id)

  // Fetch sticks from member pads
  let memberSticks: any[] = []
  if (memberPadIds.length > 0) {
    const { data: memberSticksData, error: memberSticksError } = await db
      .from("paks_pad_sticks")
      .select(`
        id, topic, content, color, user_id, pad_id, created_at, updated_at,
        paks_pads(name)
      `)
      .in("pad_id", memberPadIds)
      .order("updated_at", { ascending: false })

    if (!memberSticksError) {
      memberSticks = memberSticksData || []
    }
  }

  // Process owned sticks
  const processedOwnedSticks: StickWithRole[] = (ownedSticks || []).map((stick: any) => ({
    id: stick.id,
    topic: stick.topic,
    content: stick.content,
    color: stick.color,
    user_id: stick.user_id,
    pad_id: stick.pad_id,
    created_at: stick.created_at,
    updated_at: stick.updated_at,
    userRole: "owner" as const,
    pad_name: stick.paks_pads?.name,
    owner_id: stick.user_id,
  }))

  // Process member sticks from pads
  const processedMemberSticks: StickWithRole[] = memberSticks.map((stick: any) => {
    const padMembership = padMemberships?.find((pm: any) => pm.pad_id === stick.pad_id)
    return {
      id: stick.id,
      topic: stick.topic,
      content: stick.content,
      color: stick.color,
      user_id: stick.user_id,
      pad_id: stick.pad_id,
      created_at: stick.created_at,
      updated_at: stick.updated_at,
      userRole: (padMembership?.role || "view") as "admin" | "edit" | "view",
      pad_name: stick.paks_pads?.name,
      owner_id: stick.user_id,
    }
  })

  const processedDirectSticks: StickWithRole[] = (stickMemberships || [])
    .filter((sm: any) => sm.paks_pad_sticks)
    .map((sm: any) => ({
      id: sm.paks_pad_sticks.id,
      topic: sm.paks_pad_sticks.topic,
      content: sm.paks_pad_sticks.content,
      color: sm.paks_pad_sticks.color,
      user_id: sm.paks_pad_sticks.user_id,
      pad_id: sm.paks_pad_sticks.pad_id,
      created_at: sm.paks_pad_sticks.created_at,
      updated_at: sm.paks_pad_sticks.updated_at,
      userRole: sm.role as "admin" | "edit" | "view",
      pad_name: sm.paks_pad_sticks.paks_pads?.name,
      owner_id: sm.paks_pad_sticks.user_id,
    }))

  // Combine and deduplicate
  const allSticks = [...processedOwnedSticks, ...processedMemberSticks, ...processedDirectSticks]
  const uniqueSticks = allSticks.filter((stick, index, self) => index === self.findIndex((s) => s.id === stick.id))

  return uniqueSticks
}
