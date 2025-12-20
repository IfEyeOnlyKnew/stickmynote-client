import { getSession } from "@/lib/auth/local-auth"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "0")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""

    console.log("[v0] GET /api/user/accessible-pads - Query params:", { page, limit, search })

    const offset = page * limit
    let query = `
      SELECT 
        pp.id,
        pp.name,
        pp.created_at,
        pp.owner_id,
        pp.multi_pak_id,
        mp.name as multi_pak_name
      FROM paks_pads pp
      LEFT JOIN multi_paks mp ON mp.id = pp.multi_pak_id
      WHERE pp.owner_id = $1
         OR pp.id IN (
           SELECT pad_id FROM paks_pad_members WHERE user_id = $1
         )
    `
    const params: any[] = [user.id]

    if (search) {
      query += ` AND pp.name ILIKE $${params.length + 1}`
      params.push(`%${search}%`)
    }

    query += ` ORDER BY pp.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    console.log("[v0] GET /api/user/accessible-pads - Successfully fetched", result.rows.length, "pads")

    const formattedPads = result.rows.map((pad: any) => ({
      id: pad.id,
      name: pad.name,
      isOwner: pad.owner_id === user.id,
      multiPakName: pad.multi_pak_name || null,
      href: `/pads/${pad.id}`,
    }))

    return NextResponse.json({
      pads: formattedPads,
      hasMore: result.rows.length === limit,
    })
  } catch (error) {
    console.error("[v0] GET /api/user/accessible-pads - Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
