import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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
    const { key_results, ...objectiveData } = body

    const { data: objective, error: objError } = await supabase
      .from("objectives")
      .update(objectiveData)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle()

    if (objError) throw objError

    // Delete existing key results
    await supabase.from("key_results").delete().eq("objective_id", params.id)

    // Create new key results
    if (key_results && key_results.length > 0) {
      const keyResultsData = key_results.map((kr: any) => ({
        ...kr,
        objective_id: params.id,
        progress: Math.round(((kr.current_value - kr.start_value) / (kr.target_value - kr.start_value)) * 100),
      }))

      const { error: krError } = await supabase.from("key_results").insert(keyResultsData)

      if (krError) throw krError
    }

    return NextResponse.json(objective)
  } catch (error) {
    console.error("Error updating objective:", error)
    return NextResponse.json({ error: "Failed to update objective" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

    const { error } = await supabase.from("objectives").delete().eq("id", params.id).eq("user_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting objective:", error)
    return NextResponse.json({ error: "Failed to delete objective" }, { status: 500 })
  }
}
