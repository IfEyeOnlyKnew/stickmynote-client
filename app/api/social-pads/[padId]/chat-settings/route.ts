import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { DEFAULT_CHAT_SETTINGS } from "@/types/pad-chat"

export const dynamic = "force-dynamic"

// ============================================================================
// Helpers
// ============================================================================

async function isPadOwnerOrModerator(db: any, padId: string, userId: string): Promise<boolean> {
  // Check if user is pad owner
  const { data: pad } = await db
    .from("social_pads")
    .select("owner_id")
    .eq("id", padId)
    .maybeSingle()

  if (pad?.owner_id === userId) return true

  // Check if user is moderator with settings permission
  const { data: moderator } = await db
    .from("social_pad_chat_moderators")
    .select("can_manage_settings")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle()

  return moderator?.can_manage_settings === true
}

// ============================================================================
// GET - Fetch chat settings
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    // Fetch settings or return defaults
    const { data: settings, error } = await db
      .from("social_pad_chat_settings")
      .select("*")
      .eq("social_pad_id", padId)
      .maybeSingle()

    if (error && error.code !== "42P01") {
      console.error("[ChatSettings] Error fetching:", error)
    }

    return NextResponse.json({
      settings: settings || { ...DEFAULT_CHAT_SETTINGS, social_pad_id: padId },
    })
  } catch (error) {
    console.error("[ChatSettings] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PUT - Update chat settings
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    // Check permissions
    const canManage = await isPadOwnerOrModerator(db, padId, authResult.user.id)
    if (!canManage) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body

    // Upsert settings
    const { data: updatedSettings, error } = await db
      .from("social_pad_chat_settings")
      .upsert({
        social_pad_id: padId,
        ...settings,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "social_pad_id",
      })
      .select()
      .single()

    if (error) {
      console.error("[ChatSettings] Error updating:", error)
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
    }

    return NextResponse.json({ settings: updatedSettings })
  } catch (error) {
    console.error("[ChatSettings] PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
