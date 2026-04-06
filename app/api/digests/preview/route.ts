import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { previewDigest } from "@/lib/handlers/digests-handler"

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const frequency = (searchParams.get("frequency") || "daily") as "daily" | "weekly"

    const html = await previewDigest(authResult.user, frequency)

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    })
  } catch (error) {
    console.error("Digest preview error:", error)
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 })
  }
}
