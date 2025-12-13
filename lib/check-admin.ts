import { createClient } from "@/lib/supabase/server"

export type AdminRole =
  | "global_admin"
  | "social_hub_admin"
  | "verified_admin"
  | "network_admin"
  | "answers_admin"
  | "corporate_communicator"
  | "community_admin"

export async function checkAdminRole(userId: string, requiredRole?: AdminRole): Promise<boolean> {
  const supabase = await createClient()

  const query = supabase.from("social_hub_admins").select("role").eq("user_id", userId)

  if (requiredRole) {
    query.eq("role", requiredRole)
  }

  const { data } = await query.single()

  return !!data
}

export async function getUserAdminRoles(userId: string): Promise<AdminRole[]> {
  const supabase = await createClient()

  const { data } = await supabase.from("social_hub_admins").select("role").eq("user_id", userId)

  return data?.map((d) => d.role as AdminRole) || []
}

export async function isGlobalAdmin(userId: string): Promise<boolean> {
  return checkAdminRole(userId, "global_admin")
}
