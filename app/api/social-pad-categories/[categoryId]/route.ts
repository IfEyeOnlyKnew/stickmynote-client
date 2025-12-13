import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function PATCH(request: Request, { params }: { params: { categoryId: string } }) {
  try {
    const supabase = await createServerClient()

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

    const body = await request.json()
    const { name, description } = body

    const { data: category, error } = await supabase
      .from("social_pad_categories")
      .update({
        name: name?.trim(),
        description: description?.trim() || null,
      })
      .eq("id", params.categoryId)
      .eq("owner_id", user.id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error("Error updating category:", error)
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { categoryId: string } }) {
  try {
    const supabase = await createServerClient()

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

    const { error } = await supabase
      .from("social_pad_categories")
      .delete()
      .eq("id", params.categoryId)
      .eq("owner_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting category:", error)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
