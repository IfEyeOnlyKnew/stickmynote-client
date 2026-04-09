import { type NextRequest, NextResponse } from "next/server"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { createRateLimitResponse } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"

// POST /api/noted/clip - Create a Noted page from clipped web content
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const allowed = await safeRateLimit(request, user.id, "noted_clip")
    if (!allowed) return createRateLimitResponse()

    const body = await request.json()
    const { title, content, url, selection } = body

    if (!title && !content && !selection) {
      return NextResponse.json({ error: "Content required" }, { status: 400 })
    }

    // Build page content with source attribution
    const clippedContent = selection || content || ""
    const sourceAttribution = url
      ? `<p><em>Clipped from: <a href="${url}">${url}</a></em></p><hr />`
      : ""
    const pageContent = `${sourceAttribution}${clippedContent}`

    const result = await pgClient.query(
      `INSERT INTO noted_pages (user_id, org_id, title, content, is_personal, source_content)
       VALUES ($1, $2, $3, $4, false, $5)
       RETURNING *`,
      [
        user.id,
        orgContext.orgId,
        title || "Web Clip",
        pageContent,
        url || "",
      ]
    )

    // Return with CORS headers for bookmarklet cross-origin
    const response = NextResponse.json({ data: result.rows[0] }, { status: 201 })
    response.headers.set("Access-Control-Allow-Origin", "*")
    return response
  } catch (err) {
    console.error("Failed to create clip:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-csrf-token",
      "Access-Control-Allow-Credentials": "true",
    },
  })
}
