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

  // Fetch owned sticks
  const { data: ownedSticks, error: ownedError } = await db
    .from("paks_pad_sticks")
    .select("id, topic, content, color, user_id, pad_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  // Fetch pad memberships
  const { data: padMemberships, error: padMemberError } = await db
    .from("paks_pad_members")
    .select("role, accepted, pad_id")
    .eq("user_id", userId)
    .eq("accepted", true)

  // Fetch stick memberships
  const { data: stickMemberships, error: stickMemberError } = await db
    .from("paks_pad_stick_members")
    .select("role, stick_id")
    .eq("user_id", userId)

  if (ownedError && padMemberError && stickMemberError) {
    console.error("Failed to fetch sticks:", { ownedError, padMemberError, stickMemberError })
    return []
  }

  // Get sticks for stick memberships
  const stickMembershipStickIds = (stickMemberships || []).map((sm: any) => sm.stick_id)
  let stickMembershipSticks: any[] = []
  if (stickMembershipStickIds.length > 0) {
    const { data } = await db
      .from("paks_pad_sticks")
      .select("id, topic, content, color, user_id, pad_id, created_at, updated_at")
      .in("id", stickMembershipStickIds)
    stickMembershipSticks = data || []
  }

  const memberPadIds = (padMemberships || []).map((pm: any) => pm.pad_id)

  // Fetch sticks from member pads
  let memberSticks: any[] = []
  if (memberPadIds.length > 0) {
    const { data: memberSticksData, error: memberSticksError } = await db
      .from("paks_pad_sticks")
      .select("id, topic, content, color, user_id, pad_id, created_at, updated_at")
      .in("pad_id", memberPadIds)
      .order("updated_at", { ascending: false })

    if (!memberSticksError) {
      memberSticks = memberSticksData || []
    }
  }

  // Collect all pad IDs and fetch pad names separately
  const allPadIds = [
    ...(ownedSticks || []).map((s: any) => s.pad_id),
    ...memberPadIds,
    ...memberSticks.map((s: any) => s.pad_id),
    ...stickMembershipSticks.map((s: any) => s.pad_id),
  ].filter(Boolean)
  const uniquePadIds = [...new Set(allPadIds)]

  let padNameMap = new Map<string, string>()
  if (uniquePadIds.length > 0) {
    const { data: pads } = await db
      .from("paks_pads")
      .select("id, name")
      .in("id", uniquePadIds)
    for (const pad of pads || []) {
      padNameMap.set(pad.id, pad.name)
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
    pad_name: stick.pad_id ? padNameMap.get(stick.pad_id) : undefined,
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
      pad_name: stick.pad_id ? padNameMap.get(stick.pad_id) : undefined,
      owner_id: stick.user_id,
    }
  })

  // Create a map of stick_id to stick data for direct memberships
  const stickDataMap = new Map<string, any>()
  for (const stick of stickMembershipSticks) {
    stickDataMap.set(stick.id, stick)
  }

  const processedDirectSticks: StickWithRole[] = (stickMemberships || [])
    .filter((sm: any) => stickDataMap.has(sm.stick_id))
    .map((sm: any) => {
      const stick = stickDataMap.get(sm.stick_id)
      return {
        id: stick.id,
        topic: stick.topic,
        content: stick.content,
        color: stick.color,
        user_id: stick.user_id,
        pad_id: stick.pad_id,
        created_at: stick.created_at,
        updated_at: stick.updated_at,
        userRole: sm.role as "admin" | "edit" | "view",
        pad_name: stick.pad_id ? padNameMap.get(stick.pad_id) : undefined,
        owner_id: stick.user_id,
      }
    })

  // Combine and deduplicate
  const allSticks = [...processedOwnedSticks, ...processedMemberSticks, ...processedDirectSticks]
  const uniqueSticks = allSticks.filter((stick, index, self) => index === self.findIndex((s) => s.id === stick.id))

  return uniqueSticks
}
