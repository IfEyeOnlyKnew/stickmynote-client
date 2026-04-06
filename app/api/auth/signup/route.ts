import { type NextRequest, NextResponse } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { handleSignup } from "@/lib/handlers/auth-handler"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
    }

    const body = await request.json()
    const result = await handleSignup(body)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("Sign up error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
