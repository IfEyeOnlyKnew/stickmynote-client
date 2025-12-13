import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Send email API - Processing email request")

    if (!process.env.RESEND_API_KEY) {
      console.log("[v0] Send email API - RESEND_API_KEY not found")
      return NextResponse.json({ error: "RESEND_API_KEY environment variable is not set" }, { status: 500 })
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      console.log("[v0] Send email API - RESEND_FROM_EMAIL not found")
      return NextResponse.json({ error: "RESEND_FROM_EMAIL environment variable is not set" }, { status: 500 })
    }

    const { to, subject, html, text } = await request.json()

    console.log("[v0] Send email API - Email details:", {
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      hasHtml: !!html,
      hasText: !!text,
      fromEmail: process.env.RESEND_FROM_EMAIL,
      hasApiKey: !!process.env.RESEND_API_KEY,
    })

    if (!to || !subject || (!html && !text)) {
      console.log("[v0] Send email API - Missing required fields")
      return NextResponse.json({ error: "Missing required fields: to, subject, and html or text" }, { status: 400 })
    }

    console.log("[v0] Send email API - Attempting to send email via Resend...")

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    })

    if (error) {
      console.error("[v0] Send email API - Resend error:", error)
      console.error("[v0] Send email API - Resend error details:", {
        message: error.message,
        name: error.name,
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log("[v0] Send email API - Email sent successfully:", data)
    console.log("[v0] Send email API - Email send result details:", {
      id: data?.id,
      from: process.env.RESEND_FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Send email API - Unexpected error:", error)
    console.error("[v0] Send email API - Unexpected error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
    })
    return NextResponse.json(
      { error: "Failed to send email", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
