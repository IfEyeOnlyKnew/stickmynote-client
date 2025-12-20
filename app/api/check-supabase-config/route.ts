import { NextResponse } from "next/server"
import { isDiagnosticAccessible } from "@/lib/is-production"

export async function GET() {
  if (!isDiagnosticAccessible()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const config = {
      databaseUrl: !!process.env.DATABASE_URL,
      ldapUrl: !!process.env.LDAP_URL,
      jwtSecret: !!process.env.JWT_SECRET,
      resendApiKey: !!process.env.RESEND_API_KEY,
      nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL || "Not set",
      environment: process.env.NODE_ENV || "unknown",
    }

    const issues: string[] = []

    if (!config.databaseUrl) issues.push("DATABASE_URL is missing")
    if (!config.ldapUrl) issues.push("LDAP_URL is missing")
    if (!config.jwtSecret) issues.push("JWT_SECRET is missing")
    if (!config.resendApiKey) issues.push("RESEND_API_KEY is missing (optional for email features)")
    if (config.nextPublicSiteUrl === "Not set") issues.push("NEXT_PUBLIC_SITE_URL is not set")

    return NextResponse.json({
      success: issues.filter(i => !i.includes("optional")).length === 0,
      config,
      issues,
      recommendations:
        issues.length > 0
          ? [
              "Add missing environment variables to your .env.local file",
              "Ensure DATABASE_URL points to your PostgreSQL instance",
              "Configure LDAP_URL for Active Directory authentication",
              "Restart your application after adding environment variables",
            ]
          : [
              "All required environment variables are configured",
              "Database and authentication are ready",
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
