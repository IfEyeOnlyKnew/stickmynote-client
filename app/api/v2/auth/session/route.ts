// v2 Auth Session API: production-quality, get current session
import { getSession } from '@/lib/auth/local-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/auth/session - Get current user session
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return new Response(JSON.stringify({ user: null }), { status: 200 })
    }

    return new Response(
      JSON.stringify({
        user: {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.full_name,
          avatar_url: session.user.avatar_url,
          email_verified: session.user.email_verified,
        },
        expiresAt: session.expiresAt,
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('[API] Error fetching session:', error)
    return new Response(JSON.stringify({ user: null }), { status: 200 })
  }
}
