import { NextResponse } from "next/server"
import { isDiagnosticAccessible } from "@/lib/is-production"

export async function GET() {
  if (!isDiagnosticAccessible()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const deploymentInfo = {
      status: "deployed",
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV,
      buildId: process.env.BUILD_ID || "unknown",
      timestamp: new Date().toISOString(),
      domain: process.env.NEXT_PUBLIC_SITE_URL || "localhost:3000",
      features: {
        authentication: !!process.env.JWT_SECRET,
        database: !!process.env.POSTGRES_HOST || !!process.env.DATABASE_URL,
        ai_integration: !!process.env.OLLAMA_BASE_URL || !!process.env.OLLAMA_MODEL,
        email: !!process.env.RESEND_API_KEY || !!process.env.SMTP_HOST,
        blob_storage: !!process.env.BLOB_READ_WRITE_TOKEN,
        redis: !!process.env.UPSTASH_REDIS_REST_URL || !!process.env.REDIS_URL,
      },
      checks: {
        environment_variables: checkEnvironmentVariables(),
        database_connection: "pending", // Would need actual DB check
        external_services: "pending", // Would need service checks
      },
    }

    return NextResponse.json(deploymentInfo, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

function checkEnvironmentVariables() {
  const required = [
    "POSTGRES_HOST",
    "POSTGRES_DATABASE",
    "POSTGRES_USER",
    "NEXT_PUBLIC_SITE_URL",
  ]

  const missing = required.filter((key) => !process.env[key])

  return {
    status: missing.length === 0 ? "pass" : "fail",
    missing_variables: missing,
    total_required: required.length,
    configured: required.length - missing.length,
  }
}
