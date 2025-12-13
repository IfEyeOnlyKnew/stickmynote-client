import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { CalstickCache } from "@/lib/calstick-cache"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServer()
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

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()
    const { id } = params

    const { data: calstick, error } = await supabase
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
