import { Resend } from "resend"

let resendInstance: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  resendInstance ??= new Resend(process.env.RESEND_API_KEY)
  return resendInstance
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@stickmynote.com"

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  // Resend is deprecated - will be replaced by Exchange server
  console.warn("[v0] Resend email service is deprecated. Use Exchange server instead.")
  return { success: false, error: "Email service disabled - migrating to Exchange", id: undefined }
}

export async function sendOrganizationInviteEmail({
  to,
  organizationName,
  inviterName,
  role,
  inviteToken,
}: {
  to: string
  organizationName: string
  inviterName: string
  role: string
  inviteToken: string
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stickmynote.com"
  const acceptUrl = `${siteUrl}/invites/accept?token=${inviteToken}`

  const subject = `You've been invited to join ${organizationName} on Stick My Note`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Organization Invitation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Stick My Note</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">You're Invited!</h2>
          
          <p style="color: #4b5563; font-size: 16px;">
            <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Click the button below to accept the invitation and join the organization:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 6px;">
            ${acceptUrl}
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} Stick My Note. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  return sendEmail({ to, subject, html })
}
