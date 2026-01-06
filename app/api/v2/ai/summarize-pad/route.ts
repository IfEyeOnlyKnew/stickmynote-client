// v2 AI Summarize Pad API: production-quality, summarize pad content and progress
import { generateText } from 'ai'
import { db } from '@/lib/database/pg-client'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/v2/ai/summarize-pad - Summarize a pad's content and progress
export async function POST(request: Request) {
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

    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { padId } = await request.json()

    if (!padId) {
      return new Response(JSON.stringify({ error: 'Pad ID is required' }), { status: 400 })
    }

    // Fetch pad info
    const padResult = await db.query(
      `SELECT * FROM paks_pads WHERE id = $1 AND org_id = $2`,
      [padId, orgContext.orgId]
    )
    const pad = padResult.rows[0]

    if (!pad) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    // Fetch sticks with calstick counts
    const sticksResult = await db.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM paks_pad_stick_replies r WHERE r.stick_id = s.id) as reply_count
       FROM paks_pad_sticks s
       WHERE s.pad_id = $1 AND s.org_id = $2`,
      [padId, orgContext.orgId]
    )

    const sticksContext = sticksResult.rows
      .map(
        (stick: any) => `
      Topic: ${stick.topic || 'Untitled'}
      Content: ${stick.content}
      Tasks: ${stick.reply_count || 0}
    `
      )
      .join('\n')

    const { text } = await generateText({
      model: 'xai/grok-2-1212' as any,
      prompt: `Summarize the progress and content of this project pad named "${pad.name}".

      Pad Description: ${pad.description || 'None'}

      Sticks (Tasks/Notes):
      ${sticksContext}

      Provide a concise executive summary focusing on key themes, workload, and overall status. Use markdown formatting.`,
    })

    return new Response(JSON.stringify({ summary: text }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
