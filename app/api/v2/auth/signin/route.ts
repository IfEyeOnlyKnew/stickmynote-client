// v2 Auth Signin API: production-quality, authenticate user
import { type NextRequest } from 'next/server'
import { authenticateWithAD } from '@/lib/auth/ldap-auth'
import { createToken } from '@/lib/auth/local-auth'
import { checkLockout, recordLoginAttempt } from '@/lib/auth/lockout'
import { validateCSRFMiddleware } from '@/lib/csrf'
import { handleApiError } from '@/lib/api/handle-api-error'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/signin - Authenticate user with AD/LDAP
export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return new Response(JSON.stringify({ error: 'Invalid or missing CSRF token' }), { status: 403 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check lockout before attempting sign in (direct DB call - no fetch)
    const lockoutData = await checkLockout(normalizedEmail)
    if (lockoutData.locked) {
      return new Response(
        JSON.stringify({
          error: `Account is temporarily locked. Please try again in ${lockoutData.remainingMinutes} minute${lockoutData.remainingMinutes === 1 ? '' : 's'}.`,
          locked: true,
          remainingMinutes: lockoutData.remainingMinutes,
        }),
        { status: 429 }
      )
    }

    // Attempt sign in with Active Directory
    const result = await authenticateWithAD(email, password)

    if (!result.success || !result.user) {
      // Record failed attempt (direct DB call - no fetch)
      const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      await recordLoginAttempt(normalizedEmail, false, ipAddress)

      return new Response(JSON.stringify({ error: result.error || 'Invalid credentials' }), { status: 401 })
    }

    // Create JWT token for the authenticated user
    const token = await createToken(result.user.id)

    // Record successful attempt (direct DB call - no fetch)
    await recordLoginAttempt(normalizedEmail, true)

    // Set auth cookie
    const cookieStore = cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return new Response(
      JSON.stringify({
        success: true,
        user: result.user,
        session: { user: result.user },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
