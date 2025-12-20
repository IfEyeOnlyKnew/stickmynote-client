import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

// GET /api/organizations/by-domain?domain=example.com
// Lookup organization by domain (public endpoint for access requests)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get("domain")

    if (!domain) {
      return NextResponse.json({ error: "Domain parameter required" }, { status: 400 })
    }

    const result = await db.query(
      `SELECT id, name, domain, primary_contact_email, secondary_contact_email 
       FROM organizations 
       WHERE domain = $1 
       LIMIT 1`,
      [domain.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(null)
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("[API] Error looking up organization by domain:", error)
    return NextResponse.json({ error: "Failed to lookup organization" }, { status: 500 })
  }
}
