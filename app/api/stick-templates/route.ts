import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request) {
  try {
    const db = await createDatabaseClient()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    let query = db.from("paks_pad_stick_templates").select("*").order("category").order("name")

    if (category) {
      query = query.eq("category", category)
    }

    const { data: templates, error } = await query

    if (error) throw error

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
    console.error("Error fetching templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, category, topic_template, content_template, is_public } = body

    if (!name || !category || !content_template) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data: template, error } = await db
      .from("paks_pad_stick_templates")
      .insert({
        name,
        description,
        category,
        topic_template,
        content_template,
        is_public: is_public || false,
        created_by: user.id,
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ template })
  } catch (error) {
    console.error("Error creating template:", error)
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
  }
}
