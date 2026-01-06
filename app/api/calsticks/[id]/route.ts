import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { CalstickCache } from "@/lib/calstick-cache"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { data: calstick, error } = await db
      .from("paks_pad_stick_replies")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgContext.orgId)
      .eq("is_calstick", true)
      .maybeSingle()

    if (error) {
      console.error("[calsticks/id GET] Error:", error)
      return NextResponse.json({ error: "Failed to fetch CalStick" }, { status: 500 })
    }

    if (!calstick) {
      return NextResponse.json({ error: "CalStick not found" }, { status: 404 })
    }

    return NextResponse.json({ calstick })
  } catch (error) {
    console.error("[calsticks/id GET] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()

    const { data: calstick, error } = await db
      .from("paks_pad_stick_replies")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", orgContext.orgId)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: "Failed to update CalStick" }, { status: 500 })
    }

    await CalstickCache.invalidateUser(user.id)

    return NextResponse.json(calstick)
  } catch (error) {
    console.error("[calsticks/id] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
