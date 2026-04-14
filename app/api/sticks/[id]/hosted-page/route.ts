import { NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { generateHostedPageForPersonalStick, getLatestHostedPageForStick } from "@/lib/handlers/hosted-page-handler"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stickId } = await params
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const latest = await getLatestHostedPageForStick(stickId)
    if (!latest) return NextResponse.json({ exists: false })
    return NextResponse.json({ exists: true, slug: latest.slug, createdAt: latest.createdAt })
  } catch (error) {
    console.error("[HostedPage] GET error:", error)
    return NextResponse.json({ error: "Failed to check hosted page" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stickId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const origin = request.nextUrl.origin
    const result = await generateHostedPageForPersonalStick(stickId, authResult.user.id, origin)

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      slug: result.slug,
      url: `${origin}/hosted/${result.slug}`,
    })
  } catch (error) {
    console.error("[HostedPage] POST error:", error)
    return NextResponse.json({ error: "Failed to generate hosted page" }, { status: 500 })
  }
}
