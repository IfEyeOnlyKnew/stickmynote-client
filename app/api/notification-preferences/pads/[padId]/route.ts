import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function PATCH(req: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { padId } = params
    const body = await req.json()
    const { muted, digest_only } = body

    // Get current preferences
    const { data: currentPrefs, error: fetchError } = await supabase
      .from("notification_preferences")
      .select("pad_preferences")
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchError) {
      console.error("Error fetching preferences:", fetchError)
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
    }

    // Update pad-specific settings
    const padPreferences = currentPrefs?.pad_preferences || {}
    padPreferences[padId] = {
      ...padPreferences[padId],
      ...(typeof muted === "boolean" && { muted }),
      ...(typeof digest_only === "boolean" && { digest_only }),
    }

    const { data: updatedPrefs, error: updateError } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: user.id,
        pad_preferences: padPreferences,
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (updateError) {
      console.error("Error updating pad preferences:", updateError)
      return NextResponse.json({ error: "Failed to update pad preferences" }, { status: 500 })
    }

    return NextResponse.json({ preferences: updatedPrefs })
  } catch (error) {
    console.error("Error in pad preferences PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
