import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: Request, { params }: { params: { orgId: string } }) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is owner of the organization
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", params.orgId)
      .eq("user_id", user.id)
      .single()

    if (!member || member.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch server configuration
    const { data: config, error } = await supabase
      .from("server_configurations")
      .select("*")
      .eq("org_id", params.orgId)
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

export async function POST(request: Request, { params }: { params: { orgId: string } }) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is owner
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", params.orgId)
      .eq("user_id", user.id)
      .single()

    if (!member || member.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // Encrypt sensitive fields before saving
    const configToSave = {
      org_id: params.orgId,
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
    const { error } = await supabase.from("server_configurations").upsert(configToSave, { onConflict: "org_id" })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error saving server config:", error)
    return NextResponse.json({ error: "Failed to save server configuration" }, { status: 500 })
  }
}
