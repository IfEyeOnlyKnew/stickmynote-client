import { type NextRequest, NextResponse } from "next/server"

// Resend is deprecated - migrating to Exchange server
export async function POST(request: NextRequest) {
  console.warn("[v0] Send email API - Resend is deprecated, migrating to Exchange server")
  
  // For now, return success but log that emails are disabled
  const { to, subject } = await request.json().catch(() => ({ to: 'unknown', subject: 'unknown' }))
  
  console.log("[v0] Send email API - Email would have been sent to:", to, "Subject:", subject)
  
  return NextResponse.json({ 
    success: false, 
    error: "Email service is being migrated to Exchange server",
    data: { id: null }
  })
}
