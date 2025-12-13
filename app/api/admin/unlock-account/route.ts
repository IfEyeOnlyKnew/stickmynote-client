import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role, org_id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "Only organization owners can unlock accounts" }, { status: 403 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const { error } = await supabase.from("login_attempts").delete().eq("email", normalizedEmail).eq("success", false)

    if (error) {
      console.error("Error unlocking account:", error)
      return NextResponse.json({ error: "Failed to unlock account" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Account ${email} has been unlocked` })
  } catch (error) {
    console.error("Error unlocking account:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
