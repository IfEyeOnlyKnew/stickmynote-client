// v2 Auth Signup API: production-quality, create new user
import { type NextRequest } from 'next/server'
import { validateCSRFMiddleware } from '@/lib/csrf'
import { handleApiError } from '@/lib/api/handle-api-error'
import { handleSignup } from '@/lib/handlers/auth-handler'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/signup - Create new user account
export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return new Response(JSON.stringify({ error: 'Invalid or missing CSRF token' }), { status: 403 })
    }

    const body = await request.json()
    const result = await handleSignup(body)

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: result.status })
    }

    return new Response(JSON.stringify(result.data), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
