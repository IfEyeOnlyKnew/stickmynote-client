import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { data: objectives, error } = await supabase
      .from("objectives")
      .select(`
        *,
        key_results (*)
      `)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(objectives || [])
  } catch (error) {
    console.error("Error fetching objectives:", error)
    return NextResponse.json({ error: "Failed to fetch objectives" }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()
    const { key_results, ...objectiveData } = body

    const { data: objective, error: objError } = await supabase
      .from("objectives")
      .insert({
        ...objectiveData,
        user_id: user.id,
        org_id: orgContext.orgId,
      })
      .select()
      .maybeSingle()

    if (objError) throw objError

    // Create key results with org_id
    if (key_results && key_results.length > 0) {
      const keyResultsData = key_results.map((kr: any) => ({
        ...kr,
        objective_id: objective?.id,
        org_id: orgContext.orgId,
        progress: Math.round(((kr.current_value - kr.start_value) / (kr.target_value - kr.start_value)) * 100),
      }))

      const { error: krError } = await supabase.from("key_results").insert(keyResultsData)

      if (krError) throw krError
    }

    return NextResponse.json(objective)
  } catch (error) {
    console.error("Error creating objective:", error)
    return NextResponse.json({ error: "Failed to create objective" }, { status: 500 })
  }
}
