import { type NextRequest, NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import {
  verifyCalstickOwnership,
  getAttachments,
  createAttachment,
  deleteAttachment,
} from "@/lib/handlers/calsticks-attachments-handler"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const isOwner = await verifyCalstickOwnership(id, authResult.user.id, orgContext.orgId)
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await getAttachments(id, orgContext.orgId)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const isOwner = await verifyCalstickOwnership(id, authResult.user.id, orgContext.orgId)
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const result = await createAttachment(id, orgContext.orgId, authResult.user.id, body)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get("attachmentId")

    if (!attachmentId) {
      return NextResponse.json({ error: "Attachment ID required" }, { status: 400 })
    }

    const result = await deleteAttachment(attachmentId, orgContext.orgId, authResult.user.id)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
