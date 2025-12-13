import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Get user's calstick settings
export async function GET() {
  try {
    const supabase = await createSupabaseServer()

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

    const { data, error } = await supabase
      .from("users")
      .select("calstick_auto_archive_days")
      .eq("id", user.id)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      autoArchiveDays: data?.calstick_auto_archive_days ?? 14,
    })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 })
  }
}

// Update user's calstick settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()

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

    const body = await request.json()
    const { autoArchiveDays } = body

    if (typeof autoArchiveDays !== "number" || autoArchiveDays < 0 || autoArchiveDays > 365) {
      return NextResponse.json({ error: "Invalid autoArchiveDays value" }, { status: 400 })
    }

    const { error } = await supabase
      .from("users")
      .update({ calstick_auto_archive_days: autoArchiveDays })
      .eq("id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true, autoArchiveDays })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
