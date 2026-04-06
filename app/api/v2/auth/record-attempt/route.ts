// v2 Auth Record Attempt API: production-quality, record login attempt
import { type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/api/handle-api-error'
import { recordLoginAttempt } from '@/lib/handlers/auth-handler'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/record-attempt - Record login attempt (success/failure)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await recordLoginAttempt(body)

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: result.status })
    }

    return new Response(JSON.stringify(result.data), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
