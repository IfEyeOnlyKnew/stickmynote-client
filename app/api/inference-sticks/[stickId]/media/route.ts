import { type NextRequest, NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { addMedia, removeMedia } from "@/lib/handlers/inference-sticks-media-handler"

export async function POST(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()
    const result = await addMedia(stickId, authResult.user.id, orgContext.orgId, body)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Media save error:", error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { url } = await request.json()
    const result = await removeMedia(stickId, authResult.user.id, orgContext.orgId, url)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Media delete error:", error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
