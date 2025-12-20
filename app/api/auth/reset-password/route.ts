import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { randomBytes } from "node:crypto"
import { sendEmail } from "@/lib/email/smtp"

export const dynamic = "force-dynamic"

function buildPasswordResetEmailHtml(resetUrl: string, fullName: string | null = "there"): string {
  const currentYear = new Date().getFullYear()

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Stick My Note</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
          
          <p style="color: #4b5563; font-size: 16px;">
            Hi ${fullName},
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 6px;">
            ${resetUrl}
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>&copy; ${currentYear} Stick My Note. All rights reserved.</p>
        </div>
      </body>
    </html>
  `
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists
    const userResult = await db.query(
      `SELECT id, email, full_name FROM users WHERE email = $1`,
      [normalizedEmail]
    )

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with that email, a password reset link will be sent.",
      })
    }

    const user = userResult.rows[0]

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Store reset token in database
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [user.id, resetToken, expiresAt.toISOString()]
    )

    // Send password reset email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stickmynote.com"
    const resetUrl = `${siteUrl}/auth/reset-password?token=${resetToken}`
    const emailHtml = buildPasswordResetEmailHtml(resetUrl, user.full_name)

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: "Reset Your Password - Stick My Note",
      html: emailHtml,
    })

    if (emailResult.success) {
      console.log(`[Auth] Password reset email sent to ${normalizedEmail}`)
    } else {
      console.error(`[Auth] Failed to send password reset email to ${normalizedEmail}:`, emailResult.error)
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with that email, a password reset link will be sent.",
    })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
