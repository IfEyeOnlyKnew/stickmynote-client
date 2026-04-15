import { NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { generateHostedPage, getLatestHostedPageForStick, type StickKind } from "@/lib/handlers/hosted-page-handler"

const VALID_KINDS: StickKind[] = ["personal", "pad", "concur"]

function parseKind(value: string | null): StickKind {
  if (value && (VALID_KINDS as string[]).includes(value)) return value as StickKind
  return "personal"
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const kind = parseKind(request.nextUrl.searchParams.get("kind"))
    const origin = request.nextUrl.origin
    const result = await generateHostedPage(kind, stickId, authResult.user.id, origin)

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({
      slug: result.slug,
      url: `${origin}/hosted/${result.slug}`,
    })
  } catch (error) {
    console.error("[HostedPage] POST error:", error)
    return NextResponse.json({ error: "Failed to generate hosted page" }, { status: 500 })
  }
}
