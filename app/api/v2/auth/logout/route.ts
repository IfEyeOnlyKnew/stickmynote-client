// v2 Auth Logout API: production-quality, logout with CSRF validation
import { type NextRequest } from 'next/server'
import { validateCSRFMiddleware } from '@/lib/csrf'
import { cookies } from 'next/headers'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/logout - Logout with CSRF validation
export async function POST(request: NextRequest) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return new Response(JSON.stringify({ error: 'Invalid or missing CSRF token' }), { status: 403 })
    }

    // Clear auth cookies
    const cookieStore = await cookies()
    const cookiesToClear = [
      'auth-token',
      'csrf-token',
      'jwt_session',
      'session',
      'sb-access-token',
      'sb-refresh-token',
    ]

    cookiesToClear.forEach((cookieName) => {
      cookieStore.delete(cookieName)
    })

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
