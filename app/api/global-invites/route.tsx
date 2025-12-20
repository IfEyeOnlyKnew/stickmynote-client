import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Global invite API - Processing global invite request")

    const authResult = await getCachedAuthUser()
    const { emails, role = "viewer" } = await request.json()

    console.log("[v0] Global invite API - Request data:", {
      emailCount: emails?.length || 0,
      role,
    })

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      console.log("[v0] Global invite API - No emails provided")
      return NextResponse.json({ error: "Emails array is required" }, { status: 400 })
    }

    // Get current user
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "30" } })
    }

    if (!authResult.user) {
      console.log("[v0] Global invite API - Authentication failed")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    console.log("[v0] Global invite API - Authenticated user:", user.email)

    const results = {
      successful: [] as string[],
      failed: [] as { email: string; error: string }[],
    }

    for (const emailAddress of emails) {
      try {
        console.log("[v0] Global invite API - Processing email:", emailAddress)

        // Send invitation email
        const emailResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/send-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: emailAddress,
              subject: "You've been invited to join Stick My Note",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>You've been invited to join Stick My Note!</h2>
                  <p>You've been invited to join Stick My Note, a collaborative note-taking platform.</p>
                  <p>To get started, please sign up or log in:</p>
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/login" 
                     style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">
                    Join Stick My Note
                  </a>
                  <p>Start organizing your thoughts and collaborating with others!</p>
                </div>
              `,
              text: `You've been invited to join Stick My Note! To get started, please visit: ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/login`,
            }),
          },
        )

        if (emailResponse.ok) {
          const emailResult = await emailResponse.json()
          console.log("[v0] Global invite API - Email sent successfully to:", emailAddress, emailResult)
          results.successful.push(emailAddress)
        } else {
          const emailError = await emailResponse.json()
          console.log("[v0] Global invite API - Failed to send email to:", emailAddress, "Error:", emailError)
          results.failed.push({ email: emailAddress, error: "Failed to send email" })
        }
      } catch (err) {
        console.error("[v0] Global invite API - Error processing email:", emailAddress, err)
        results.failed.push({ email: emailAddress, error: (err as Error).message })
      }
    }

    console.log("[v0] Global invite API - Results:", results)
    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: emails.length,
        successful: results.successful.length,
        failed: results.failed.length,
      },
    })
  } catch (error) {
    console.error("[v0] Global invite API - Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
