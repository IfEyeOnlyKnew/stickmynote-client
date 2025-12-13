import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase-server"

export async function POST(request: Request) {
  try {
    const { userId, email, username, fullName, phone, location, bio, website, avatarUrl } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ success: false, error: "User ID and email are required" }, { status: 400 })
    }

    const supabase = await createSupabaseServer()

    const { data: existingProfile, error: selectError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single()

    if (selectError) {
      if (selectError.code === "PGRST116") {
        return NextResponse.json(
          {
            success: false,
            error: "Profile not found. Database trigger should create it automatically.",
          },
          { status: 404 },
        )
      } else if (selectError.code === "42501" || selectError.message?.includes("policy")) {
        return NextResponse.json(
          {
            success: false,
            error: "Access temporarily restricted. Please try again in a moment.",
          },
          { status: 403 },
        )
      } else {
        return NextResponse.json({ success: false, error: selectError.message }, { status: 500 })
      }
    }

    if (!existingProfile) {
      return NextResponse.json(
        {
          success: false,
          error: "Profile not found. Database trigger should create it automatically.",
        },
        { status: 404 },
      )
    }

    const profileData = {
      username: username || `user_${userId.substring(0, 8)}`,
      full_name: fullName || "User",
      phone: phone || null,
      location: location || null,
      bio: bio || null,
      website: website || null,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from("users").update(profileData).eq("id", userId).select().single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "User profile updated successfully",
      data: data,
    })
  } catch (error) {
    console.error("Update user profile error:", error)
    return NextResponse.json({ success: false, error: "Failed to update user profile" }, { status: 500 })
  }
}
