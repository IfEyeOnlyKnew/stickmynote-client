// v2 Search Related API: production-quality, find related sticks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/search/related - Find related sticks
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { stickId, limit = 5 } = await request.json()

    if (!stickId) {
      return new Response(JSON.stringify({ error: 'stickId is required' }), { status: 400 })
    }

    // Get the current stick
    const currentStickResult = await db.query(
      `SELECT topic, content, social_pad_id, ai_generated_tags FROM social_sticks WHERE id = $1`,
      [stickId]
    )

    if (currentStickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const currentStick = currentStickResult.rows[0]

    // Find related sticks (same pad, not self)
    const relatedResult = await db.query(
      `SELECT id, topic, content, created_at, color, social_pad_id, ai_generated_tags
       FROM social_sticks
       WHERE social_pad_id = $1 AND id <> $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [currentStick.social_pad_id, stickId, limit * 3]
    )

    const relatedSticks = relatedResult.rows

    // Score sticks by relevance
    const scoredSticks = (relatedSticks || []).map((stick: any) => {
      let score = 0

      // Same pad bonus
      if (stick.social_pad_id === currentStick.social_pad_id) {
        score += 10
      }

      // Tag similarity
      const currentTags = Array.isArray(currentStick.ai_generated_tags)
        ? currentStick.ai_generated_tags
        : []
      const stickTags = Array.isArray(stick.ai_generated_tags) ? stick.ai_generated_tags : []
      const commonTags = currentTags.filter((tag: string) => stickTags.includes(tag))
      score += commonTags.length * 5

      // Keyword similarity (simple approach)
      const currentWords = new Set(
        (currentStick.content || '')
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
      )
      const stickWords = (stick.content || '').toLowerCase().split(/\s+/)
      const commonWords = stickWords.filter((w: string) => w.length > 3 && currentWords.has(w))
      score += Math.min(commonWords.length, 10)

      return { ...stick, relevanceScore: score }
    })

    // Sort by relevance and return top results
    const topRelated = scoredSticks
      .toSorted((a: any, b: any) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
      .map(({ relevanceScore, ...stick }: any) => stick)

    return new Response(JSON.stringify({ relatedSticks: topRelated }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
