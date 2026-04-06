import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getCustomFields, createCustomField, deleteCustomField } from "@/lib/handlers/calsticks-custom-fields-handler"

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

    const result = await getCustomFields(authResult.user)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[custom-fields GET] Error:", error)
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
    const result = await createCustomField(authResult.user, body)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[custom-fields POST] Error:", error)
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
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const result = await deleteCustomField(authResult.user, id)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[custom-fields DELETE] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
