import { createDatabaseClient } from "@/lib/database/database-adapter"
import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  const { padId } = await params
  const db = await createDatabaseClient()

  const authResult = await getCachedAuthUser()
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

  const { data: pad } = await db.from("social_pads").select("owner_id").eq("id", padId).maybeSingle()

  if (!pad) {
    return NextResponse.json({ error: "Pad not found" }, { status: 404 })
  }

  const isOwner = pad.owner_id === user.id

  const { data: membership } = await db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", padId)
    .eq("user_id", user.id)
    .maybeSingle()

  const isAdmin = membership?.role === "admin" || membership?.role === "owner"

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Get cleanup policy
  const { data: policy, error } = await db
    .from("social_pad_cleanup_policies")
    .select("*")
    .eq("social_pad_id", padId)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return default policy if none exists
  if (!policy) {
    return NextResponse.json({
      policy: {
        social_pad_id: padId,
        auto_archive_enabled: false,
        archive_after_days: 90,
        archive_after_replies: null,
        auto_delete_enabled: false,
        delete_archived_after_days: 180,
        max_sticks_per_pad: null,
        max_sticks_per_user: null,
        auto_close_resolved_enabled: false,
        close_resolved_after_days: 7,
        exempt_pinned_sticks: true,
        exempt_workflow_active: true,
      },
    })
  }

  return NextResponse.json({ policy })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  const { padId } = await params
  const db = await createDatabaseClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is pad owner
  const { data: pad } = await db.from("social_pads").select("owner_id").eq("id", padId).single()

  if (!pad) {
    return NextResponse.json({ error: "Pad not found" }, { status: 404 })
  }

  if (pad.owner_id !== user.id) {
    return NextResponse.json({ error: "Only pad owner can update cleanup policy" }, { status: 403 })
  }

  const body = await request.json()

  // Validate input
  const validFields = [
    "auto_archive_enabled",
    "archive_after_days",
    "archive_after_replies",
    "auto_delete_enabled",
    "delete_archived_after_days",
    "max_sticks_per_pad",
    "max_sticks_per_user",
    "auto_close_resolved_enabled",
    "close_resolved_after_days",
    "exempt_pinned_sticks",
    "exempt_workflow_active",
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of validFields) {
    if (field in body) {
      updateData[field] = body[field]
    }
  }

  // Upsert policy
  const { data: policy, error } = await db
    .from("social_pad_cleanup_policies")
    .upsert(
      {
        social_pad_id: padId,
        created_by: user.id,
        ...updateData,
      },
      {
        onConflict: "social_pad_id",
      },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ policy })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  const { padId } = await params
  const db = await createDatabaseClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is pad owner
  const { data: pad } = await db.from("social_pads").select("owner_id").eq("id", padId).single()

  if (!pad || pad.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await db.from("social_pad_cleanup_policies").delete().eq("social_pad_id", padId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
