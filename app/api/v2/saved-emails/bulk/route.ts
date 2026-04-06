// v2 Saved Emails Bulk API: production-quality, bulk operations
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import {
  bulkDeleteSavedEmails,
  bulkAddSavedEmails,
  parseCSVEmails,
  validateAndParseEmails,
} from '@/lib/handlers/saved-emails-handler'

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

    const body = await request.json()
    const { emailIds, teamId } = body

    const result = await bulkDeleteSavedEmails(authResult.user, emailIds, teamId)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error: any) {
    if (error?.message === 'Invalid email IDs array') {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
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

    if (isFormDataRequest) {
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return new Response(JSON.stringify({ error: 'No CSV file provided' }), { status: 400 })
      }

      const parsedEmails = await parseCSVEmails(file)
      const result = await bulkAddSavedEmails(user, parsedEmails, 'csv')
      return new Response(JSON.stringify({ success: true, ...result }), { status: 200 })
    }

    // Handle JSON bulk add
    const body = await request.json()
    const { emails } = body

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid emails array' }), { status: 400 })
    }

    const validEmails = validateAndParseEmails(emails)
    if (validEmails.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid email addresses found' }), { status: 400 })
    }

    const result = await bulkAddSavedEmails(user, validEmails, 'bulk')
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200 })
  } catch (error: any) {
    if (error?.message?.includes('CSV') || error?.message?.includes('email')) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
    return handleApiError(error)
  }
}
