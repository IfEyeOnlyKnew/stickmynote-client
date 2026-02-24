// v2 Calsticks Feed Generate API: production-quality, generate calendar feed token
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { randomBytes } from 'crypto'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { checkDLPPolicy } from '@/lib/dlp/policy-checker'

export const dynamic = 'force-dynamic'

// POST /api/v2/calsticks/feed/generate - Generate a new feed token
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
    const user = authResult.user

    // DLP check for iCal feed generation
    const orgContext = await getOrgContext()
    if (orgContext) {
      const dlpResult = await checkDLPPolicy({
        orgId: orgContext.orgId,
        action: 'generate_ical',
        userId: user.id,
      })
      if (!dlpResult.allowed) {
        return new Response(JSON.stringify({ error: dlpResult.reason }), { status: 403 })
      }
    }

    // Generate a secure random token
    const token = randomBytes(32).toString('hex')

    const result = await db.query(
      `INSERT INTO paks_pad_calendar_feeds (user_id, name, token, is_active, filters)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, name) DO UPDATE SET
         token = EXCLUDED.token,
         is_active = EXCLUDED.is_active
       RETURNING *`,
      [user.id, 'My CalSticks', token, true, JSON.stringify({ include_completed: false })]
    )

    // Return the full feed URL
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const host = request.headers.get('host') || 'localhost:3000'
    const feedUrl = `${protocol}://${host}/api/v2/calsticks/feed/ical/${token}`

    return new Response(JSON.stringify({ url: feedUrl, token }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/v2/calsticks/feed/generate - Get existing feed URL
export async function GET(request: NextRequest) {
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

    const result = await db.query(
      `SELECT token FROM paks_pad_calendar_feeds
       WHERE user_id = $1 AND is_active = true
       LIMIT 1`,
      [user.id]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ url: null }), { status: 200 })
    }

    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const host = request.headers.get('host') || 'localhost:3000'
    const feedUrl = `${protocol}://${host}/api/v2/calsticks/feed/ical/${result.rows[0].token}`

    return new Response(
      JSON.stringify({ url: feedUrl, token: result.rows[0].token }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
