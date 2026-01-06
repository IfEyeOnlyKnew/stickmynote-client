import { type NextRequest, NextResponse } from "next/server"
import { SearchEngine } from "@/lib/search-engine"
import { getSession } from "@/lib/auth/local-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") || ""
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50"), 100)
    const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0"), 0)
    const fuzzy = searchParams.get("fuzzy") !== "false"

    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const result = await SearchEngine.searchSticks({
      query,
      limit,
      offset,
      fuzzy,
      userId: user.id,
      orgId: orgContext.orgId,
    })

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    })
  } catch (error) {
    console.error("[API] Search sticks error:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
