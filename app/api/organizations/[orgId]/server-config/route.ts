import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const db = await createDatabaseClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is owner of the organization
    const { data: member } = await db
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!member || member.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch server configuration
    const { data: config, error } = await db
      .from("server_configurations")
      .select("*")
      .eq("org_id", orgId)
      .single()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return NextResponse.json({ config: config || {} })
  } catch (error) {
    console.error("[v0] Error fetching server config:", error)
    return NextResponse.json({ error: "Failed to fetch server configuration" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const db = await createDatabaseClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is owner
    const { data: member } = await db
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!member || member.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // Encrypt sensitive fields before saving
    const configToSave = {
      org_id: orgId,
      ...body,
      // In production, encrypt these fields using a proper encryption library
      postgres_password_encrypted: body.postgres_password
        ? Buffer.from(body.postgres_password).toString("base64")
        : null,
      smtp_password_encrypted: body.smtp_password ? Buffer.from(body.smtp_password).toString("base64") : null,
      redis_password_encrypted: body.redis_password ? Buffer.from(body.redis_password).toString("base64") : null,
    }

    // Remove plain text passwords
    delete configToSave.postgres_password
    delete configToSave.smtp_password
    delete configToSave.redis_password

    // Upsert configuration
    const { error } = await db.from("server_configurations").upsert(configToSave, { onConflict: "org_id" })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error saving server config:", error)
    return NextResponse.json({ error: "Failed to save server configuration" }, { status: 500 })
  }
}
