import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
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

    const { data: accounts, error } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error("Error fetching accounts:", error)
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const { username, email, full_name } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from("social_accounts")
      .select("id")
      .eq("owner_id", user.id)
      .eq("email", email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Account with this email already exists" }, { status: 409 })
    }

    const { data: account, error } = await supabase
      .from("social_accounts")
      .insert({
        owner_id: user.id,
        username,
        email,
        full_name,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    console.error("Error creating account:", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}
