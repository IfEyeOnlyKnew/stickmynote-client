// v2 Calsticks Custom Fields API: production-quality, manage custom field definitions
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getCustomFields, createCustomField, deleteCustomField } from '@/lib/handlers/calsticks-custom-fields-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/custom-fields - Get custom field definitions
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

    const result = await getCustomFields(authResult.user)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/custom-fields - Create custom field definition
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
    const result = await createCustomField(authResult.user, body)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/calsticks/custom-fields - Delete custom field definition
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
    const id = searchParams.get('id')

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 })
    }

    const result = await deleteCustomField(authResult.user, id)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
