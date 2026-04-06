import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { togglePin, reorderPin } from "@/lib/handlers/inference-sticks-pin-handler"

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { stickId } = await params
    const result = await togglePin(stickId, authResult.user.id, orgContext.orgId)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Error toggling pin:", error)
    return NextResponse.json({ error: "Failed to pin/unpin stick" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { stickId } = await params
    const { pin_order } = await request.json()

    const result = await reorderPin(stickId, authResult.user.id, orgContext.orgId, pin_order)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Error reordering pinned stick:", error)
    return NextResponse.json({ error: "Failed to reorder pinned stick" }, { status: 500 })
  }
}
