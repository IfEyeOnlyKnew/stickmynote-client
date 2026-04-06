// v2 Saved Emails API: production-quality, manage saved emails
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getSavedEmails, createSavedEmails, deleteSavedEmail } from '@/lib/handlers/saved-emails-handler'

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

    const { searchParams } = new URL(request.url)
    const result = await getSavedEmails(authResult.user, {
      teamId: searchParams.get('teamId'),
      search: searchParams.get('search'),
    })

    return new Response(JSON.stringify(result), { status: 200 })
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

    const body = await request.json()
    const result = await createSavedEmails(authResult.user, body)

    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error: any) {
    if (error?.message === 'Invalid emails array' || error?.message === 'No valid emails provided') {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
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

    const { searchParams } = new URL(request.url)
    const result = await deleteSavedEmail(authResult.user, {
      emailId: searchParams.get('id'),
      email: searchParams.get('email'),
      teamId: searchParams.get('teamId'),
    })

    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error: any) {
    if (error?.message === 'Email ID or email address required') {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
    return handleApiError(error)
  }
}
