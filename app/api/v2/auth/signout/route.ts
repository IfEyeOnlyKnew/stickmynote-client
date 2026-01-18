// v2 Auth Signout API: production-quality, clear session
import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/signout - Clear user session
export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Clear the JWT session cookie
    cookieStore.delete('jwt_session')

    // Also clear any other auth-related cookies
    cookieStore.delete('session')
    cookieStore.delete('sb-access-token')
    cookieStore.delete('sb-refresh-token')

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    // Still return success to clear client state even if something fails
    console.error('Signout error:', error)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
}
