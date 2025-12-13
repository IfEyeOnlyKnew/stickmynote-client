import { redirect } from "next/navigation"
import { createSupabaseServer } from "@/lib/supabase-server"

/**
 * Server-side function to check if user has full_access hub_mode
 * Redirects to /notes if user has personal_only hub_mode
 * Call this at the top of server components that require full_access
 */
export async function requireFullAccess() {
  const supabase = await createSupabaseServer()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth/login")
  }

  // Fetch user profile to check hub_mode
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("hub_mode")
    .eq("id", user.id)
    .single()

  if (profileError) {
    console.error("[v0] requireFullAccess - Error fetching profile:", profileError.message)
    // Default to allowing access if there's an error fetching profile
    return user
  }

  const hubMode = profile?.hub_mode || "personal_only"

  console.log("[v0] requireFullAccess - user:", user.email, "hubMode:", hubMode)

  if (hubMode === "personal_only") {
    console.log("[v0] requireFullAccess - BLOCKING personal_only user, redirecting to /notes")
    redirect("/notes")
  }

  return user
}
