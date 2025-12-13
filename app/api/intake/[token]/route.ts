import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = await createServerClient()
    const { token } = params

    // Fetch form by token (public access)
    const { data: form, error: formError } = await supabase
      .from("intake_forms")
      .select("id, title, description, success_message, is_active")
      .eq("share_token", token)
      .eq("is_active", true)
      .single()

    if (formError || !form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    // Fetch form fields
    const { data: fields, error: fieldsError } = await supabase
      .from("intake_form_fields")
      .select("*")
      .eq("form_id", form.id)
      .order("order_index", { ascending: true })

    if (fieldsError) {
      console.error("[v0] Error fetching fields:", fieldsError)
      return NextResponse.json({ error: "Failed to fetch form fields" }, { status: 500 })
    }

    return NextResponse.json({
      form: {
        ...form,
        fields: fields || [],
      },
    })
  } catch (error) {
    console.error("[v0] Intake form API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
