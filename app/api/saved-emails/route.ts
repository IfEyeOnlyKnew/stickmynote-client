import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getSavedEmails, createSavedEmails, deleteSavedEmail } from "@/lib/handlers/saved-emails-handler"

export async function GET(request: NextRequest) {
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
    const result = await getSavedEmails(authResult.user, {
      teamId: searchParams.get("teamId"),
      search: searchParams.get("search"),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[saved-emails GET] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const result = await createSavedEmails(authResult.user, body)

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === "Invalid emails array" || error?.message === "No valid emails provided") {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("[saved-emails POST] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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
    const result = await deleteSavedEmail(authResult.user, {
      emailId: searchParams.get("id"),
      email: searchParams.get("email"),
      teamId: searchParams.get("teamId"),
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === "Email ID or email address required") {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("[saved-emails DELETE] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
