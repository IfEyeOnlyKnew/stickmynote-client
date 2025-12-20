import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import type { DatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch (err) {
    console.warn("Rate limit provider error, allowing request:", err)
    return true
  }
}

async function checkStickPermissions(db: DatabaseClient, stickId: string, userId: string) {
  const { data: stick } = await db
    .from("paks_pad_sticks")
    .select("user_id, pad_id")
    .eq("id", stickId)
    .maybeSingle()

  if (!stick) return false

  // Check if user is stick owner
  if (stick.user_id === userId) return true

  // Check pad permissions
  const { data: pad } = await db.from("paks_pads").select("owner_id").eq("id", stick.pad_id).maybeSingle()

  if (pad?.owner_id === userId) return true

  // Check pad membership
  const { data: membership } = await db
    .from("paks_pad_members")
    .select("role")
    .eq("pad_id", stick.pad_id)
    .eq("user_id", userId)
    .eq("accepted", true)
    .maybeSingle()

  return membership?.role === "admin" || membership?.role === "edit"
}

// DELETE /api/sticks/[id]/tabs/[tabId]
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; tabId: string }> }) {
  try {
    const db = await createServiceDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    const params = await context.params
    const stickId = params.id
    const tabId = params.tabId

    if (!validateUUID(stickId) || !validateUUID(tabId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    if (!(await safeRateLimit(request, user.id, "stick_tabs_delete"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    // Check permissions
    const hasPermission = await checkStickPermissions(db, stickId, user.id)
    if (!hasPermission) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { error } = await db.from("paks_pad_stick_tabs").delete().eq("id", tabId).eq("stick_id", stickId)

    if (error) {
      console.error("Error deleting stick tab:", error)
      return NextResponse.json({ error: "Failed to delete tab" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("DELETE /api/sticks/[id]/tabs/[tabId] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
