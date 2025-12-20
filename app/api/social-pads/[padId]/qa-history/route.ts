import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(req: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const url = new URL(req.url)
    const limit = Number.parseInt(url.searchParams.get("limit") || "20")

    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new NextResponse(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { "Retry-After": "30" },
      })
    }
    if (!authResult.user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return new NextResponse("No organization context", { status: 403 })
    }

    // Fetch Q&A history for this pad
    const { data: history, error } = await db
      .from("social_qa_history")
      .select("*")
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .order("asked_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error fetching Q&A history:", error)
      return new NextResponse("Error fetching history", { status: 500 })
    }

    return NextResponse.json({ history: history || [] })
  } catch (error) {
    console.error("[QA History] Error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
