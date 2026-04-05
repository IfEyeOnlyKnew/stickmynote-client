import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

// GET /api/organizations - Get all organizations for current user
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user

    const result = await db.query(
      `SELECT 
        om.id,
        om.org_id,
        om.role,
        om.accepted_at,
        om.created_at,
        o.id as org_id,
        o.name as org_name,
        o.slug as org_slug,
        o.type as org_type,
        o.settings as org_settings,
        o.created_at as org_created_at,
        o.updated_at as org_updated_at
       FROM organization_members om
       INNER JOIN organizations o ON o.id = om.org_id
       WHERE om.user_id = $1
       ORDER BY om.created_at ASC`,
      [user.id]
    )

    // Transform to match expected format
    const memberships = result.rows.map(row => ({
      id: row.id,
      org_id: row.org_id,
      role: row.role,
      accepted_at: row.accepted_at,
      created_at: row.created_at,
      organizations: {
        id: row.org_id,
        name: row.org_name,
        slug: row.org_slug,
        type: row.org_type,
        settings: row.org_settings,
        created_at: row.org_created_at,
        updated_at: row.org_updated_at,
      }
    }))

    return NextResponse.json({ memberships })
  } catch (err) {
    console.error("[v0] Unexpected error in GET /api/organizations:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/organizations - Create a new organization
export async function POST(req: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user

    const body = await req.json()
    const { name, type = "team" } = body

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Organization name must be at least 2 characters" }, { status: 400 })
    }

    if (type !== "team" && type !== "enterprise") {
      return NextResponse.json({ error: "Invalid organization type" }, { status: 400 })
    }

    // Generate unique slug
    const baseSlug = name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "")
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`

    // Create organization and add owner in a transaction
    const client = await db.getClient()
    try {
      await client.query("BEGIN")

      // Create organization
      const orgResult = await client.query(
        `INSERT INTO organizations (name, slug, type, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, name, slug, type, settings, created_at, updated_at`,
        [name.trim(), slug, type, JSON.stringify({})]
      )

      const newOrg = orgResult.rows[0]

      // Add creator as owner
      await client.query(
        `INSERT INTO organization_members (org_id, user_id, role, accepted_at, created_at)
         VALUES ($1, $2, 'owner', NOW(), NOW())`,
        [newOrg.id, user.id]
      )

      await client.query("COMMIT")

      return NextResponse.json({ organization: newOrg }, { status: 201 })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } catch (err) {
    console.error("[v0] Unexpected error in POST /api/organizations:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
