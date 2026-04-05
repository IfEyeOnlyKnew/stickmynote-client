import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { stickId, limit = 5 } = await request.json()
    if (!stickId) {
      return NextResponse.json({ error: "stickId is required" }, { status: 400 })
    }
    // Get the current stick
    const currentStickResult = await db.query(
      `SELECT topic, content, social_pad_id, ai_generated_tags FROM social_sticks WHERE id = $1`,
      [stickId]
    )
    const currentStick = currentStickResult.rows[0]
    if (!currentStick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }
    // Find related sticks (same pad, not self)
    const relatedResult = await db.query(
      `SELECT id, topic, content, created_at, color, social_pad_id, ai_generated_tags FROM social_sticks WHERE social_pad_id = $1 AND id <> $2 ORDER BY created_at DESC LIMIT $3`,
      [currentStick.social_pad_id, stickId, limit * 3]
    )
    const relatedSticks = relatedResult.rows
    // Score sticks by relevance
    const scoredSticks = (relatedSticks || []).map((stick) => {
      let score = 0
      // Same pad bonus
      if (stick.social_pad_id === currentStick.social_pad_id) {
        score += 10
      }
      // Tag similarity
      const currentTags = Array.isArray(currentStick.ai_generated_tags) ? currentStick.ai_generated_tags : []
      const stickTags = Array.isArray(stick.ai_generated_tags) ? stick.ai_generated_tags : []
      const commonTags = currentTags.filter((tag) => stickTags.includes(tag))
      score += commonTags.length * 5
      // Keyword similarity (simple approach)
      const currentWords = new Set(
        (currentStick.content || "")
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3),
      )
      const stickWords = (stick.content || "").toLowerCase().split(/\s+/)
      const commonWords = stickWords.filter((w) => w.length > 3 && currentWords.has(w))
      score += Math.min(commonWords.length, 10)
      return { ...stick, relevanceScore: score }
    })
    // Sort by relevance and return top results
    const topRelated = scoredSticks
      .toSorted((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
      .map(({ relevanceScore, ...stick }) => stick)
    return NextResponse.json({ relatedSticks: topRelated })
  } catch (error) {
    console.error("[v0] Error in related search route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
