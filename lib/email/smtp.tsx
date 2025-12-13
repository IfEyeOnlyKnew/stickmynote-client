import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
}

class SMTPEmailService {
  private transporter: Transporter | null = null

  constructor() {
    this.initialize()
  }

  private initialize() {
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = Number.parseInt(process.env.SMTP_PORT || "587")
    const smtpUser = process.env.SMTP_USER
    const smtpPassword = process.env.SMTP_PASSWORD
    const smtpSecure = process.env.SMTP_SECURE === "true" // true for 465, false for other ports
    const smtpFrom = process.env.SMTP_FROM_EMAIL || "noreply@stickmynote.com"

    if (!smtpHost) {
      console.warn("[Email] SMTP_HOST not configured, email sending disabled")
      return
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth:
          smtpUser && smtpPassword
            ? {
                user: smtpUser,
                pass: smtpPassword,
              }
            : undefined,
        // For internal Exchange relay without auth
        tls: {
          rejectUnauthorized: false, // Allow self-signed certs in internal network
        },
      })

      console.log(`[Email] SMTP configured: ${smtpHost}:${smtpPort}`)
    } catch (error) {
      console.error("[Email] SMTP initialization error:", error)
      this.transporter = null
    }
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter) {
      console.warn("[Email] SMTP not configured, skipping email")
      return { success: false, error: "Email service not configured" }
    }

    try {
      const fromEmail = options.from || process.env.SMTP_FROM_EMAIL || "noreply@stickmynote.com"

      const info = await this.transporter.sendMail({
        from: fromEmail,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ""),
      })

      console.log(`[Email] Sent to ${options.to}: ${info.messageId}`)

      return {
        success: true,
        messageId: info.messageId,
      }
    } catch (error) {
      console.error("[Email] Send error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      }
    }
  }

  async sendOrganizationInvite(params: {
    to: string
    organizationName: string
    inviterName: string
    role: string
    inviteToken: string
  }): Promise<{ success: boolean; error?: string }> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stickmynote.com"
    const acceptUrl = `${siteUrl}/invites/accept?token=${params.inviteToken}`

    const subject = `You've been invited to join ${params.organizationName} on Stick My Note`

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
              <strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong> as a <strong>${params.role}</strong>.
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

    return this.sendEmail({ to: params.to, subject, html })
  }

  async verify(): Promise<boolean> {
    if (!this.transporter) {
      return false
    }

    try {
      await this.transporter.verify()
      console.log("[Email] SMTP connection verified")
      return true
    } catch (error) {
      console.error("[Email] SMTP verification failed:", error)
      return false
    }
  }
}

// Singleton instance
export const emailService = new SMTPEmailService()

// Helper function compatible with existing Resend API
export async function sendEmail(options: { to: string; subject: string; html: string; text?: string }) {
  return emailService.sendEmail(options)
}

export async function sendOrganizationInviteEmail(params: {
  to: string
  organizationName: string
  inviterName: string
  role: string
  inviteToken: string
}) {
  return emailService.sendOrganizationInvite(params)
}
