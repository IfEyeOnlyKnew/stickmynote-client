import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const supabase = await createClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 })
    }

    // Just wait a moment for the trigger to complete
    await new Promise((resolve) => setTimeout(resolve, 1000))

    return NextResponse.json({ message: "User processed successfully" })
  } catch (error) {
    console.error("Handle signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
