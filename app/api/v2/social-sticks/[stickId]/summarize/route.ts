// v2 Social Sticks Summarize API: production-quality, AI summarization
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { AIService } from '@/lib/ai/ai-service'
import { handleApiError } from '@/lib/api/handle-api-error'
import { isAIAvailable, checkOllamaHealth, getProviderDisplayName } from '@/lib/ai/ai-provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Increase timeout for AI processing

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

    // Check if AI is available before proceeding
    if (!isAIAvailable()) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Please set OLLAMA_MODEL or other AI provider credentials.' }),
        { status: 503 }
      )
    }

    // Check Ollama health if using Ollama
    const ollamaHealth = await checkOllamaHealth()
    if (!ollamaHealth.available && process.env.AI_PROVIDER === 'ollama') {
      return new Response(
        JSON.stringify({ error: `Ollama server not available: ${ollamaHealth.error}. Make sure Ollama is running.` }),
        { status: 503 }
      )
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

    // Generate AI summary using configured provider (Ollama by default)
    const summary = await AIService.generateLiveSummary({
      topic: stick.topic || 'Untitled',
      content: stick.content,
      replies: formattedReplies,
    })

    // Extract action items
    const actionItems = await AIService.extractActionItems({
      topic: stick.topic || 'Untitled',
      content: stick.content,
      replies: formattedReplies,
    })

    // Generate suggested questions
    const suggestedQuestions = await AIService.generateNextQuestions({
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

    console.log(`[v2/Summarize] Generated summary for stick ${stickId} using ${getProviderDisplayName()}`)

    return new Response(
      JSON.stringify({
        summary,
        actionItems,
        suggestedQuestions,
        replyCount: repliesResult.rows.length,
        provider: getProviderDisplayName(),
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
