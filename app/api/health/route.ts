import { NextResponse } from "next/server"
import { performHealthCheck } from "@/lib/production-health"

export async function GET() {
  try {
    const healthCheck = await performHealthCheck()

    const healthData = {
      status: healthCheck.overall,
      timestamp: healthCheck.timestamp,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || "1.0.0",
      checks: healthCheck.checks,
      summary: {
        total: healthCheck.checks.length,
        healthy: healthCheck.checks.filter((c) => c.status === "healthy").length,
        degraded: healthCheck.checks.filter((c) => c.status === "degraded").length,
        unhealthy: healthCheck.checks.filter((c) => c.status === "unhealthy").length,
      },
    }

    const statusCode = healthCheck.overall === "healthy" ? 200 : healthCheck.overall === "degraded" ? 200 : 503

    return NextResponse.json(healthData, { status: statusCode })
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || "1.0.0",
      },
      { status: 500 },
    )
  }
}
