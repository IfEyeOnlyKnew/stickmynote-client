// v2 Saved Emails Bulk API: production-quality, bulk operations
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// DELETE /api/v2/saved-emails/bulk - Bulk delete emails
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

    const body = await request.json()
    const { emailIds, teamId } = body

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid email IDs array' }), { status: 400 })
    }

    if (teamId) {
      await db.query(
        `DELETE FROM saved_emails WHERE user_id = $1 AND id = ANY($2) AND team_id = $3`,
        [user.id, emailIds, teamId]
      )
    } else {
      await db.query(
        `DELETE FROM saved_emails WHERE user_id = $1 AND id = ANY($2)`,
        [user.id, emailIds]
      )
    }

    return new Response(
      JSON.stringify({ success: true, deletedCount: emailIds.length }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/saved-emails/bulk - Bulk add emails (JSON or CSV)
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

    const contentType = request.headers.get('content-type')
    const uploadType = request.headers.get('x-upload-type')
    const isFormDataRequest = contentType?.includes('multipart/form-data') || uploadType === 'csv-file'

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let emailsToInsert: { email: string; name: string | null }[] = []

    if (isFormDataRequest) {
      // Handle CSV file upload
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return new Response(JSON.stringify({ error: 'No CSV file provided' }), { status: 400 })
      }

      const fileText = await file.text()
      if (!fileText.trim()) {
        return new Response(JSON.stringify({ error: 'CSV file is empty' }), { status: 400 })
      }

      const lines = fileText.split(/\r?\n/).filter((line) => line.trim())
      emailsToInsert = lines
        .map((line) => {
          const trimmedLine = line.trim().replaceAll(/^["']|["']$/g, '')
          if (trimmedLine.includes(',')) {
            const [email, name] = trimmedLine.split(',').map((s) => s.trim().replaceAll(/^["']|["']$/g, ''))
            return { email: email?.toLowerCase(), name: name || null }
          } else {
            return { email: trimmedLine.toLowerCase(), name: null }
          }
        })
        .filter((item) => item.email && emailRegex.test(item.email))
    } else {
      // Handle JSON bulk add
      const body = await request.json()
      const { emails } = body

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid emails array' }), { status: 400 })
      }

      emailsToInsert = emails
        .filter((emailItem: any) => {
          const email = typeof emailItem === 'string' ? emailItem : emailItem.email
          return email && emailRegex.test(email)
        })
        .map((emailItem: any) => {
          const email = typeof emailItem === 'string' ? emailItem : emailItem.email
          const name = typeof emailItem === 'object' && emailItem.name ? emailItem.name : null
          return { email: email.toLowerCase().trim(), name }
        })
    }

    if (emailsToInsert.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid email addresses found' }),
        { status: 400 }
      )
    }

    // Check for existing emails
    const existingResult = await db.query(
      `SELECT email FROM saved_emails WHERE user_id = $1 AND email = ANY($2) AND team_id IS NULL`,
      [user.id, emailsToInsert.map((e) => e.email)]
    )
    const existingEmailSet = new Set(existingResult.rows.map((e: any) => e.email))

    const newEmails = emailsToInsert.filter((e) => !existingEmailSet.has(e.email))
    const duplicateCount = emailsToInsert.length - newEmails.length

    if (newEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          added: 0,
          skipped: duplicateCount,
          message: 'All emails already exist in your saved list',
        }),
        { status: 200 }
      )
    }

    // Insert new emails
    const source = isFormDataRequest ? 'csv' : 'bulk'
    const insertValues = newEmails
      .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
      .join(', ')
    const insertParams: any[] = [user.id]
    newEmails.forEach((e) => {
      insertParams.push(e.email, e.name, source)
    })

    const insertResult = await db.query(
      `INSERT INTO saved_emails (user_id, email, name, source)
       VALUES ${insertValues}
       RETURNING *`,
      insertParams
    )

    return new Response(
      JSON.stringify({
        success: true,
        added: insertResult.rows.length,
        skipped: duplicateCount,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
