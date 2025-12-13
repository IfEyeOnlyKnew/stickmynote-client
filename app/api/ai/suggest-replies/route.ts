import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GrokService } from "@/lib/ai/grok-service"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content, topic } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Generate reply suggestions using Grok
    const suggestions = await GrokService.suggestReplies(content, topic)

    return NextResponse.json({ suggestions })
  } catch (error) {
    return NextResponse.json({ error: "Failed to suggest replies" }, { status: 500 })
  }
}
