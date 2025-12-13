import { createSupabaseServer } from "@/lib/supabase-server"

export interface PadWithRole {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  userRole: "owner" | "admin" | "editor" | "viewer"
  accepted?: boolean
}

function mapRoleFromDatabase(dbRole: string): "admin" | "editor" | "viewer" {
  if (dbRole === "edit") return "editor"
  if (dbRole === "view") return "viewer"
  return dbRole as "admin" | "editor" | "viewer"
}

export async function fetchUserPads(userId: string): Promise<PadWithRole[]> {
  const supabase = await createSupabaseServer()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  if (user.id !== userId) {
    return []
  }

  const { data: ownedPads, error: ownedError } = await supabase
    .from("paks_pads")
    .select("id, name, description, owner_id, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })

  const { data: memberPads, error: memberError } = await supabase
    .from("paks_pad_members")
    .select(`
      role,
      accepted,
      paks_pads(id, name, description, owner_id, created_at)
    `)
    .eq("user_id", userId)

  if (ownedError && memberError) {
    console.error("Failed to fetch pads:", { ownedError, memberError })
    return []
  }

  const processedOwnedPads: PadWithRole[] = (ownedPads || []).map((pad) => ({
    ...pad,
    userRole: "owner" as const,
    accepted: true,
  }))

  const processedMemberPads: PadWithRole[] = (memberPads || [])
    .filter((item: any) => item.paks_pads)
    .map((item: any) => ({
      id: item.paks_pads.id,
      name: item.paks_pads.name,
      description: item.paks_pads.description,
      owner_id: item.paks_pads.owner_id,
      created_at: item.paks_pads.created_at,
      userRole: mapRoleFromDatabase(item.role),
      accepted: item.accepted,
    }))

  const allPads = [...processedOwnedPads, ...processedMemberPads]
  const uniquePads = allPads.filter((pad, index, self) => index === self.findIndex((p) => p.id === pad.id))

  return uniquePads
}
