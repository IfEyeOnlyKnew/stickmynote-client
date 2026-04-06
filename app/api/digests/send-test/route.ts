import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { sendTestDigest } from "@/lib/handlers/digests-handler"

export async function POST(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { frequency = "daily" } = await request.json()

    const result = await sendTestDigest(authResult.user, frequency)

    if (!result.success) {
      const status = result.error === "No email address found" ? 400 : 500
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      success: true,
      emailId: result.emailId,
      notificationCount: result.notificationCount,
    })
  } catch (error) {
    console.error("[v0] Send test digest error:", error)
    return NextResponse.json({ error: "Failed to send test digest" }, { status: 500 })
  }
}
