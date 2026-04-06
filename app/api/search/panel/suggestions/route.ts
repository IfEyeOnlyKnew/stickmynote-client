import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getSearchSuggestions } from "@/lib/handlers/search-handler"

export async function GET() {
  try {
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

    const suggestions = await getSearchSuggestions(authResult.user)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error("[v0] Error fetching search suggestions:", error)
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 })
  }
}
