import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")
    const hubType = searchParams.get("hub_type")

    let query = supabase.from("paks_pad_templates").select("*").order("use_count", { ascending: false }).order("name")

    if (category) {
      query = query.eq("category", category)
    }

    if (hubType) {
      query = query.or(`hub_type.eq.${hubType},hub_type.is.null`)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error("Error fetching pad templates:", error)
      return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
    }

    // Get categories with counts
    const categories = templates?.reduce(
      (acc, template) => {
        acc[template.category] = (acc[template.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return NextResponse.json({ templates, categories })
  } catch (error) {
    console.error("Error in pad templates GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

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

    const body = await req.json()
    const { name, description, category, hub_type, access_mode, initial_sticks, icon_name, color_scheme, is_public } =
      body

    if (!name || !category) {
      return NextResponse.json({ error: "Name and category are required" }, { status: 400 })
    }

    const { data: template, error } = await supabase
      .from("paks_pad_templates")
      .insert({
        name,
        description,
        category,
        hub_type,
        access_mode: access_mode || "individual_sticks",
        initial_sticks: initial_sticks || [],
        icon_name,
        color_scheme,
        is_public: is_public || false,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating pad template:", error)
      return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error("Error in pad templates POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
