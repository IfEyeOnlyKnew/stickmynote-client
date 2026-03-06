import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const { data: form, error: formError } = await db
      .from("intake_forms")
      .select("id")
      .eq("id", id)
      .eq("owner_id", authResult.userId)
      .maybeSingle()

    if (formError || !form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    const body = await request.json()
    const { fields } = body

    // Delete existing fields
    await db.from("intake_form_fields").delete().eq("form_id", id)

    // Insert new fields
    if (fields && fields.length > 0) {
      const fieldRows = fields.map((f: any, i: number) => ({
        form_id: id,
        field_name: f.field_name,
        field_label: f.field_label,
        field_type: f.field_type,
        field_options: f.field_options || null,
        is_required: f.is_required || false,
        placeholder: f.placeholder || null,
        help_text: f.help_text || null,
        order_index: i,
      }))

      const { error: insertError } = await db.from("intake_form_fields").insert(fieldRows)
      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[intake-forms fields PUT] Error:", error)
    return NextResponse.json({ error: "Failed to save fields" }, { status: 500 })
  }
}
