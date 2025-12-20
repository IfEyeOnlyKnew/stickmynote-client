// v2 Social Sticks Summarize API: production-quality, AI summarization
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { GrokService } from '@/lib/ai/grok-service'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/v2/social-sticks/[stickId]/summarize - Generate AI summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    // Get stick with user info
    const stickResult = await db.query(
      `SELECT ss.*, u.full_name, u.email
       FROM social_sticks ss
       LEFT JOIN users u ON ss.user_id = u.id
       WHERE ss.id = $1 AND ss.org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Get replies with user info
    const repliesResult = await db.query(
      `SELECT r.*, u.full_name, u.email
       FROM social_stick_replies r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.social_stick_id = $1
       ORDER BY r.created_at ASC`,
      [stickId]
    )

    const formattedReplies = repliesResult.rows.map((r: any) => ({
      content: r.content,
      author: r.full_name || r.email || 'Unknown',
      created_at: r.created_at,
    }))

    // Generate AI summary
    const summary = await GrokService.generateLiveSummary({
      topic: stick.topic || 'Untitled',
      content: stick.content,
      replies: formattedReplies,
    })

    // Extract action items
    const actionItems = await GrokService.extractActionItems({
      topic: stick.topic || 'Untitled',
      content: stick.content,
      replies: formattedReplies,
    })

    // Generate suggested questions
    const suggestedQuestions = await GrokService.generateNextQuestions({
      topic: stick.topic || 'Untitled',
      content: stick.content,
      summary,
      sentiment: stick.ai_sentiment || undefined,
    })

    // Update stick with AI data
    await db.query(
      `UPDATE social_sticks
       SET live_summary = $1, action_items = $2, suggested_questions = $3,
           last_summarized_at = NOW(), summary_reply_count = $4
       WHERE id = $5`,
      [summary, JSON.stringify(actionItems), JSON.stringify(suggestedQuestions), repliesResult.rows.length, stickId]
    )

    return new Response(
      JSON.stringify({
        summary,
        actionItems,
        suggestedQuestions,
        replyCount: repliesResult.rows.length,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
