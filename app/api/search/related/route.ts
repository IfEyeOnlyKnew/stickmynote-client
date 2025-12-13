import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
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
    const user = authResult.user

    const { stickId, limit = 5 } = await request.json()

    if (!stickId) {
      return NextResponse.json({ error: "stickId is required" }, { status: 400 })
    }

    // Get the current stick
    const { data: currentStick, error: stickError } = await supabase
      .from("social_sticks")
      .select("topic, content, social_pad_id, ai_generated_tags")
      .eq("id", stickId)
      .maybeSingle()

    if (stickError || !currentStick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Find related sticks based on:
    // 1. Same pad
    // 2. Similar tags
    // 3. Similar content (keyword matching)

    const { data: relatedSticks, error: relatedError } = await supabase
      .from("social_sticks")
      .select("id, topic, content, created_at, color, social_pad_id, ai_generated_tags")
      .eq("social_pad_id", currentStick.social_pad_id)
      .neq("id", stickId)
      .order("created_at", { ascending: false })
      .limit(limit * 3) // Get more to filter by relevance

    if (relatedError) {
      console.error("[v0] Error fetching related sticks:", relatedError)
      return NextResponse.json({ error: "Failed to fetch related sticks" }, { status: 500 })
    }

    // Score sticks by relevance
    const scoredSticks = (relatedSticks || []).map((stick) => {
      let score = 0

      // Same pad bonus
      if (stick.social_pad_id === currentStick.social_pad_id) {
        score += 10
      }

      // Tag similarity
      const currentTags = (currentStick.ai_generated_tags as string[]) || []
      const stickTags = (stick.ai_generated_tags as string[]) || []
      const commonTags = currentTags.filter((tag) => stickTags.includes(tag))
      score += commonTags.length * 5

      // Keyword similarity (simple approach)
      const currentWords = new Set(
        currentStick.content
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 3),
      )
      const stickWords = stick.content.toLowerCase().split(/\s+/)
      const commonWords = stickWords.filter((w: string) => w.length > 3 && currentWords.has(w))
      score += Math.min(commonWords.length, 10)

      return { ...stick, relevanceScore: score }
    })

    // Sort by relevance and return top results
    const topRelated = scoredSticks
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
      .map(({ relevanceScore, ...stick }) => stick)

    return NextResponse.json({ relatedSticks: topRelated })
  } catch (error) {
    console.error("[v0] Error in related search route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
