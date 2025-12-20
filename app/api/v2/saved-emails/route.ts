// v2 Saved Emails API: production-quality, manage saved emails
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/saved-emails - Fetch saved emails
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

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const search = searchParams.get('search')

    const actualTeamId = teamId === 'global-multipaks' ? null : teamId

    let queryStr = `SELECT * FROM saved_emails WHERE user_id = $1`
    const params: any[] = [user.id]
    let paramIndex = 2

    // Filter by team
    if (actualTeamId) {
      queryStr += ` AND team_id = $${paramIndex}`
      params.push(actualTeamId)
      paramIndex++
    } else if (teamId === 'global-multipaks') {
      queryStr += ` AND team_id IS NULL`
    }

    // Search filter
    if (search) {
      queryStr += ` AND (email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    queryStr += ` ORDER BY created_at DESC LIMIT 100`

    const result = await db.query(queryStr, params)

    return new Response(JSON.stringify({ savedEmails: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/saved-emails - Create saved emails
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

    const body = await request.json()
    const { emails, teamId, source = 'manual' } = body

    const actualTeamId = teamId === 'global-multipaks' ? null : teamId

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid emails array' }), { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const validEmails = emails.filter((emailData: any) => {
      const email = typeof emailData === 'string' ? emailData : emailData.email
      return email && emailRegex.test(email)
    })

    if (validEmails.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid emails provided' }), { status: 400 })
    }

    // Prepare emails for insertion
    const emailsToInsert = validEmails.map((emailData: any) => {
      const email = typeof emailData === 'string' ? emailData : emailData.email
      const name = typeof emailData === 'string' ? null : emailData.name || null
      return {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
      }
    })

    // Check for existing emails
    const existingResult = await db.query(
      `SELECT email FROM saved_emails WHERE user_id = $1 AND email = ANY($2) AND ${actualTeamId ? 'team_id = $3' : 'team_id IS NULL'}`,
      actualTeamId
        ? [user.id, emailsToInsert.map((e) => e.email), actualTeamId]
        : [user.id, emailsToInsert.map((e) => e.email)]
    )
    const existingEmailSet = new Set(existingResult.rows.map((e: any) => e.email))

    const newEmails = emailsToInsert.filter((e) => !existingEmailSet.has(e.email))
    const duplicateCount = emailsToInsert.length - newEmails.length

    if (newEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          savedCount: 0,
          skipped: duplicateCount,
          message: 'All emails already exist',
          savedEmails: [],
        }),
        { status: 200 }
      )
    }

    // Insert new emails
    const insertValues = newEmails
      .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`)
      .join(', ')
    const insertParams: any[] = [user.id]
    newEmails.forEach((e) => {
      insertParams.push(actualTeamId, e.email, e.name, source)
    })

    const insertResult = await db.query(
      `INSERT INTO saved_emails (user_id, team_id, email, name, source)
       VALUES ${insertValues}
       RETURNING *`,
      insertParams
    )

    return new Response(
      JSON.stringify({
        success: true,
        savedCount: insertResult.rows.length,
        skipped: duplicateCount,
        savedEmails: insertResult.rows,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/saved-emails - Delete saved email
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('id')
    const email = searchParams.get('email')
    const teamId = searchParams.get('teamId')

    if (!emailId && !email) {
      return new Response(JSON.stringify({ error: 'Email ID or email address required' }), { status: 400 })
    }

    if (emailId) {
      await db.query(
        `DELETE FROM saved_emails WHERE id = $1 AND user_id = $2`,
        [emailId, user.id]
      )
    } else if (email) {
      if (teamId) {
        await db.query(
          `DELETE FROM saved_emails WHERE email = $1 AND user_id = $2 AND team_id = $3`,
          [email.toLowerCase().trim(), user.id, teamId]
        )
      } else {
        await db.query(
          `DELETE FROM saved_emails WHERE email = $1 AND user_id = $2`,
          [email.toLowerCase().trim(), user.id]
        )
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
