import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
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

    const { data: categories, error } = await db
      .from("social_pad_categories")
      .select("*")
      .eq("owner_id", user.id)
      .order("display_order", { ascending: true })

    // If table doesn't exist, return empty array instead of error
    if (error && error.code === "PGRST205") {
      console.log("[v0] Categories table not found, returning empty array")
      return NextResponse.json({ categories: [] })
    }

    if (error) throw error

    return NextResponse.json({ categories: categories || [] })
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json({ categories: [] })
  }
}

export async function POST(request: Request) {
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

    const body = await request.json()
    const { name, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 })
    }

    // Get the highest display_order
    const { data: existingCategories } = await db
      .from("social_pad_categories")
      .select("display_order")
      .eq("owner_id", user.id)
      .order("display_order", { ascending: false })
      .limit(1)

    const nextOrder = existingCategories && existingCategories.length > 0 ? existingCategories[0].display_order + 1 : 0

    const { data: category, error } = await db
      .from("social_pad_categories")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner_id: user.id,
        display_order: nextOrder,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ category })
  } catch (error) {
    console.error("Error creating category:", error)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
