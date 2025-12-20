import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params
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

  const { data: rule, error } = await db
    .from("notification_escalation_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 })
  }

  return NextResponse.json({ rule })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params
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

  try {
    const body = await request.json()

    const { data: rule, error } = await db
      .from("notification_escalation_rules")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ruleId)
      .eq("user_id", user.id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    return NextResponse.json({ rule })
  } catch (err) {
    console.error("Error updating rule:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params
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

  const { error } = await db
    .from("notification_escalation_rules")
    .delete()
    .eq("id", ruleId)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
