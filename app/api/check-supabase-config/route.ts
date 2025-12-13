import { NextResponse } from "next/server"
import { isDiagnosticAccessible } from "@/lib/is-production"

export async function GET() {
  if (!isDiagnosticAccessible()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const config = {
      supabaseUrl: !!process.env.SUPABASE_URL,
      supabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      resendApiKey: !!process.env.RESEND_API_KEY,
      nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL || "Not set",
      environment: process.env.NODE_ENV || "unknown",
    }

    const issues = []

    if (!config.supabaseUrl) issues.push("SUPABASE_URL is missing")
    if (!config.supabaseAnonKey) issues.push("SUPABASE_ANON_KEY is missing")
    if (!config.supabaseServiceRoleKey) issues.push("SUPABASE_SERVICE_ROLE_KEY is missing")
    if (!config.resendApiKey) issues.push("RESEND_API_KEY is missing")
    if (config.nextPublicSiteUrl === "Not set") issues.push("NEXT_PUBLIC_SITE_URL is not set")

    return NextResponse.json({
      success: issues.length === 0,
      config,
      issues,
      recommendations:
        issues.length > 0
          ? [
              "Add missing environment variables to your Vercel project settings",
              "For local development, add them to your .env.local file",
              "Restart your application after adding environment variables",
            ]
          : [
              "All required environment variables are configured",
              "You can now test email functionality and user management",
            ],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
