import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(req: Request, { params }: { params: Promise<{ qaId: string }> }) {
  try {
    const { qaId } = await params
    const { was_helpful, feedback_text } = await req.json()

    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return new NextResponse(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { "Retry-After": "30" },
      })
    }
    if (!authResult.user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const user = authResult.user

    // Update the Q&A record with feedback
    const { error } = await supabase
      .from("social_qa_history")
      .update({
        was_helpful,
        feedback_text: feedback_text || null,
      })
      .eq("id", qaId)
      .eq("asked_by", user.id)

    if (error) {
      console.error("Error updating feedback:", error)
      return new NextResponse("Error updating feedback", { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[QA Feedback] Error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
