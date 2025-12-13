import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient } from "@/lib/supabase/server"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Verification email API - Processing request")

    if (!process.env.RESEND_API_KEY) {
      console.error("[v0] Verification email API - RESEND_API_KEY not configured")
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      console.error("[v0] Verification email API - RESEND_FROM_EMAIL not configured")
      return NextResponse.json({ error: "Email sender not configured" }, { status: 500 })
    }

    const { email, fullName, userId } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    console.log("[v0] Verification email API - Sending to:", email)

    // Generate a magic link using Supabase
    const supabase = await createClient()

    // Get the site URL for the redirect
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"

    // Generate OTP/Magic link token via Supabase Admin
    const { createClient: createAdminClient } = await import("@supabase/supabase-js")
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Generate a magic link for the user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: `${siteUrl}/dashboard`,
      },
    })

    if (linkError) {
      console.error("[v0] Verification email API - Failed to generate link:", linkError)
      return NextResponse.json({ error: "Failed to generate verification link" }, { status: 500 })
    }

    const verificationLink = linkData.properties?.action_link || `${siteUrl}/auth/login`

    // Create the email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - Stick My Note</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1f2937;">
                📝 Stick My Note
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #1f2937;">
                Welcome${fullName ? `, ${fullName}` : ""}!
              </h2>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Thank you for signing up for Stick My Note. Please click the button below to verify your email address and complete your registration.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verificationLink}" 
                       style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #1f2937; background-color: #fbbf24; text-decoration: none; border-radius: 8px; transition: background-color 0.2s;">
                      Verify Email & Sign In
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; word-break: break-all; color: #9ca3af;">
                ${verificationLink}
              </p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                If you didn't create an account with Stick My Note, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; text-align: center; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} Stick My Note. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: [email],
      subject: "Verify Your Email - Stick My Note",
      html: emailHtml,
    })

    if (error) {
      console.error("[v0] Verification email API - Resend error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log("[v0] Verification email API - Email sent successfully:", data?.id)
    return NextResponse.json({ success: true, messageId: data?.id })
  } catch (error) {
    console.error("[v0] Verification email API - Unexpected error:", error)
    return NextResponse.json(
      { error: "Failed to send verification email", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
