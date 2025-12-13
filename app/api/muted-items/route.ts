import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
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

  const { data: mutedItems, error } = await supabase
    .from("notification_muted_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching muted items:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ mutedItems })
}

export async function POST(request: Request) {
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

  try {
    const body = await request.json()

    const { data: mutedItem, error } = await supabase
      .from("notification_muted_items")
      .upsert(
        {
          user_id: user.id,
          entity_type: body.entity_type,
          entity_id: body.entity_id,
          muted_until: body.muted_until || null,
          reason: body.reason,
        },
        {
          onConflict: "user_id,entity_type,entity_id",
        },
      )
      .select()
      .maybeSingle()

    if (error) {
      console.error("Error muting item:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ mutedItem })
  } catch (err) {
    console.error("Error parsing request:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get("entity_type")
  const entityId = searchParams.get("entity_id")

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entity_type and entity_id are required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("notification_muted_items")
    .delete()
    .eq("user_id", user.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
