import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("owner_id", authResult.userId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch forms" }, { status: 500 })
    }

    return NextResponse.json({ forms: data })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = { id: authResult.userId }

    const body = await request.json()
    const { title, description, padId } = body

    // Get user's first pad if not specified
    let targetPadId = padId
    if (!targetPadId) {
      const { data: pads } = await supabase.from("paks_pads").select("id").eq("owner_id", user.id).limit(1)

      if (pads && pads.length > 0) {
        targetPadId = pads[0].id
      }
    }

    const { data, error } = await supabase
      .from("intake_forms")
      .insert({
        owner_id: user.id,
        pad_id: targetPadId,
        title,
        description,
      })
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: "Failed to create form" }, { status: 500 })
    }

    return NextResponse.json({ form: data })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
