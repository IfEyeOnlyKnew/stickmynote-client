import { type NextRequest, NextResponse } from "next/server"

// Resend is deprecated - migrating to Exchange server
// Email verification - migrating to Exchange server
export async function POST(request: NextRequest) {
  console.warn("[v0] Verification email API - Resend is deprecated, migrating to Exchange server")
  
  // For now, return success but log that emails are disabled
  const { email } = await request.json().catch(() => ({ email: 'unknown' }))
  
  console.log("[v0] Verification email API - Verification email would have been sent to:", email)
  
  return NextResponse.json({ 
    success: false, 
    error: "Email service is being migrated to Exchange server. Verification emails are disabled.",
    messageId: null
  })
}
