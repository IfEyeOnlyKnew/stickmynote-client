import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

const ADMIN_EMAILS = ["chrisdoran63@outlook.com"]

export async function GET() {
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

    const isAdmin = ADMIN_EMAILS.includes(user.email || "")

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      admins: [],
      currentUserRole: "global_admin",
    })
  } catch (error) {
    console.error("Error fetching admins:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

    const isAdmin = ADMIN_EMAILS.includes(user.email || "")

    if (!isAdmin) {
      return NextResponse.json({ error: "Only global admins can assign roles" }, { status: 403 })
    }

    const { userId, role } = await request.json()

    const { data: newAdmin, error } = await supabase
      .from("social_hub_admins")
      .insert({
        user_id: userId,
        role,
        granted_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ admin: newAdmin })
  } catch (error) {
    console.error("Error creating admin:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
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

    const isAdmin = ADMIN_EMAILS.includes(user.email || "")

    if (!isAdmin) {
      return NextResponse.json({ error: "Only global admins can remove roles" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("id")

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID required" }, { status: 400 })
    }

    const { error } = await supabase.from("social_hub_admins").delete().eq("id", adminId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting admin:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
