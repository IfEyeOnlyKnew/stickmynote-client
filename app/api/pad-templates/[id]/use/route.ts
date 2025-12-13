import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { id } = params

    const { data: template, error: fetchError } = await supabase
      .from("paks_pad_templates")
      .select("use_count")
      .eq("id", id)
      .maybeSingle()

    if (fetchError) {
      console.error("Error fetching template:", fetchError)
      // Don't fail the request - just log and continue
      return NextResponse.json({ success: true })
    }

    if (template) {
      const { error: updateError } = await supabase
        .from("paks_pad_templates")
        .update({ use_count: (template.use_count || 0) + 1 })
        .eq("id", id)

      if (updateError) {
        console.error("Error updating use count:", updateError)
        // Don't fail the request - just log and continue
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error incrementing pad template use count:", error)
    return NextResponse.json({ success: true })
  }
}
