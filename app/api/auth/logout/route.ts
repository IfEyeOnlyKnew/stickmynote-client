import { NextResponse, type NextRequest } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
    }

    const response = NextResponse.json({ success: true })

    // Clear auth cookies
    const cookieStore = cookies()
    const cookiesToClear = ["auth-token", "csrf-token"]

    cookiesToClear.forEach((cookieName) => {
      cookieStore.delete(cookieName)
      response.cookies.delete(cookieName)
    })

    return response
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
