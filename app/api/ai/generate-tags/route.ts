import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { GrokService } from "@/lib/ai/grok-service"

/**
 * Simplified tag generation endpoint using GrokService.
 * For full functionality with hyperlinks and caching, use /api/generate-tags instead.
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const { content, topic } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Generate tags using Grok
    const tags = await GrokService.generateTags(content, topic)

    return NextResponse.json({ tags })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    return NextResponse.json({ error: "Failed to generate tags" }, { status: 500 })
  }
}
