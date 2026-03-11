import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateCSRFMiddleware } from "@/lib/csrf"
import {
  getChannelCategories,
  createChannelCategory,
  updateChannelCategory,
  deleteChannelCategory,
} from "@/lib/database/stick-chat-queries"

/**
 * CHANNEL CATEGORIES API
 *
 * GET    /api/channels/categories - List categories
 * POST   /api/channels/categories - Create category
 * PATCH  /api/channels/categories - Update category
 * DELETE /api/channels/categories - Delete category
 */

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext(user.id)
    if (!orgContext?.orgId) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const categories = await getChannelCategories(orgContext.orgId)
    return NextResponse.json({ categories })
  } catch (error) {
    console.error("[ChannelCategories] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext(user.id)
    if (!orgContext?.orgId) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { name, sort_order } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const category = await createChannelCategory(orgContext.orgId, name.trim(), user.id, sort_order)
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error("[ChannelCategories] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { id, name, sort_order, is_collapsed } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    const updated = await updateChannelCategory(id, { name, sort_order, is_collapsed })
    return NextResponse.json({ category: updated })
  } catch (error) {
    console.error("[ChannelCategories] PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    await deleteChannelCategory(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[ChannelCategories] DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
