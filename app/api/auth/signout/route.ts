import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = cookies()
    
    // Clear the JWT session cookie
    cookieStore.delete("jwt_session")
    
    // Also clear any other auth-related cookies
    cookieStore.delete("session")
    cookieStore.delete("sb-access-token")
    cookieStore.delete("sb-refresh-token")
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Signout error:", error)
    return NextResponse.json({ success: true }) // Still return success to clear client state
  }
}
