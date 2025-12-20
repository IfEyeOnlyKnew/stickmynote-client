import { createDatabaseClient } from "@/lib/database/database-adapter"

export type AdminRole =
  | "global_admin"
  | "social_hub_admin"
  | "verified_admin"
  | "network_admin"
  | "answers_admin"
  | "corporate_communicator"
  | "community_admin"

export async function checkAdminRole(userId: string, requiredRole?: AdminRole): Promise<boolean> {
  const db = await createDatabaseClient()

  const query = db.from("social_hub_admins").select("role").eq("user_id", userId)

  if (requiredRole) {
    query.eq("role", requiredRole)
  }

  const { data } = await query.single()

  return !!data
}

export async function getUserAdminRoles(userId: string): Promise<AdminRole[]> {
  const db = await createDatabaseClient()

  const { data } = await db.from("social_hub_admins").select("role").eq("user_id", userId)

  return data?.map((d) => d.role as AdminRole) || []
}

export async function isGlobalAdmin(userId: string): Promise<boolean> {
  return checkAdminRole(userId, "global_admin")
}
