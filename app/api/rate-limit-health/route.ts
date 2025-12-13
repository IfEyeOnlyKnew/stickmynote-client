import { NextResponse } from "next/server"
import { rateLimiter } from "@/lib/redis-rate-limiter"
import { isDiagnosticAccessible } from "@/lib/is-production"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!isDiagnosticAccessible()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const health = await rateLimiter.healthCheck()

    return NextResponse.json(
      {
        status: "ok",
        redis: health.redis,
        fallback: health.fallback,
        provider: health.provider,
        envConfigured: health.envConfigured,
        warning: health.warning ?? undefined,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        redis: false,
        fallback: true,
        provider: "memory",
        envConfigured: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
