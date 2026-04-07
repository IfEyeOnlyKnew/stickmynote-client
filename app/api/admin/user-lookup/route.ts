import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { lookupUser } from "@/lib/handlers/admin-handler"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
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

    const email = request.nextUrl.searchParams.get("email")
    const result = await lookupUser(authResult.user, email || "")

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("Error looking up user:", error)
    return NextResponse.json({ error: "Failed to look up user" }, { status: 500 })
  }
}
