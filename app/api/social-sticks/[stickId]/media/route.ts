import { type NextRequest, NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest, { params }: { params: { stickId: string } }) {
  const supabase = await createClient()
  const authResult = await getCachedAuthUser(supabase)

  if (authResult.rateLimited) {
    return createRateLimitResponse()
  }

  if (!authResult.user) {
    return createUnauthorizedResponse()
  }

  const user = authResult.user
  const orgContext = await getOrgContext(user.id)
  if (!orgContext) {
    return NextResponse.json({ error: "No organization context" }, { status: 403 })
  }

  try {
    const { url, type, filename } = await request.json()

    const { data: stick } = await supabase
      .from("social_sticks")
      .select("user_id")
      .eq("id", params.stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!stick || stick.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("social_stick_media")
      .insert({
        social_stick_id: params.stickId,
        url,
        type,
        filename,
        user_id: user.id,
        org_id: orgContext.orgId,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error saving media:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Media save error:", error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { stickId: string } }) {
  const supabase = await createClient()
  const authResult = await getCachedAuthUser(supabase)

  if (authResult.rateLimited) {
    return createRateLimitResponse()
  }

  if (!authResult.user) {
    return createUnauthorizedResponse()
  }

  const user = authResult.user
  const orgContext = await getOrgContext(user.id)
  if (!orgContext) {
    return NextResponse.json({ error: "No organization context" }, { status: 403 })
  }

  try {
    const { url } = await request.json()

    const { error } = await supabase
      .from("social_stick_media")
      .delete()
      .eq("social_stick_id", params.stickId)
      .eq("url", url)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error("[v0] Error deleting media:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Media delete error:", error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
