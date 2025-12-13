import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { id } = params

    const { data: existingTemplate, error: fetchError } = await supabase
      .from("paks_pad_stick_templates")
      .select("id, use_count")
      .eq("id", id)
      .maybeSingle()

    if (fetchError) {
      console.error("Error fetching template:", fetchError)
      return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 })
    }

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from("paks_pad_stick_templates")
      .update({ use_count: (existingTemplate.use_count || 0) + 1 })
      .eq("id", id)

    if (updateError) {
      console.error("Error updating template use count:", updateError)
      return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error incrementing template use count:", error)
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}
