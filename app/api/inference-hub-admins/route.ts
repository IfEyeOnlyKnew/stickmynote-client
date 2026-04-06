import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { isGlobalAdmin, getAdmins, createAdmin, deleteAdmin } from "@/lib/handlers/inference-hub-admins-handler"

export async function GET() {
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

    if (!isGlobalAdmin(authResult.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await getAdmins()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching admins:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    if (!isGlobalAdmin(authResult.user.email)) {
      return NextResponse.json({ error: "Only global admins can assign roles" }, { status: 403 })
    }

    const { userId, role } = await request.json()
    const admin = await createAdmin(userId, role, authResult.user.id)
    return NextResponse.json({ admin })
  } catch (error) {
    console.error("Error creating admin:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
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

    if (!isGlobalAdmin(authResult.user.email)) {
      return NextResponse.json({ error: "Only global admins can remove roles" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("id")

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID required" }, { status: 400 })
    }

    await deleteAdmin(adminId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting admin:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
