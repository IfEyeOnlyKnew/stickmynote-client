// v2 Auth Reset Password Confirm API: production-quality, confirm password reset
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import bcrypt from 'bcryptjs'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/reset-password/confirm - Confirm password reset with token
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return new Response(JSON.stringify({ error: 'Token and password are required' }), { status: 400 })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
      })
    }

    // Find valid token
    const tokenResult = await db.query(
      `SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    )

    const resetToken = tokenResult.rows[0]

    if (!resetToken) {
      return new Response(JSON.stringify({ error: 'Invalid or expired reset token' }), { status: 400 })
    }

    if (resetToken.used) {
      return new Response(JSON.stringify({ error: 'This reset link has already been used' }), {
        status: 400,
      })
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This reset link has expired' }), { status: 400 })
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10)

    // Update user password
    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      resetToken.user_id,
    ])

    // Mark token as used
    await db.query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [resetToken.id])

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password updated successfully. You can now log in with your new password.',
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
