import { NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

type HealthStatus = "success" | "warning" | "error"

interface HealthCheck {
  status: HealthStatus
  message: string
  details: Record<string, unknown>
}

// Helper: Check database connectivity
async function checkDatabase(): Promise<HealthCheck> {
  try {
    const db = await createServiceDatabaseClient()
    const { error, count } = await db.from("users").select("*", { count: "exact", head: true })
    
    if (error) {
      return {
        status: "error",
        message: `Database error: ${error.message}`,
        details: { error: error.message }
      }
    }
    
    return {
      status: "success",
      message: "Connected to PostgreSQL",
      details: { connected: true, userCount: count || 0 }
    }
  } catch (err: any) {
    return {
      status: "error",
      message: `Database error: ${err.message}`,
      details: { error: err.message }
    }
  }
}

// Helper: Check auth system
async function checkAuth(): Promise<HealthCheck> {
  try {
    const authResult = await getCachedAuthUser()
    const user = authResult?.user
    return {
      status: "success",
      message: "Auth system operational",
      details: { hasUser: !!user, userId: user?.id }
    }
  } catch {
    return {
      status: "warning",
      message: "Auth check completed (no active session)",
      details: { hasUser: false }
    }
  }
}

// Helper: Check environment variables
function checkEnvironment(): HealthCheck {
  const requiredEnvVars = ["DATABASE_URL", "POSTGRES_HOST", "POSTGRES_DB", "JWT_SECRET"]
  
  const envStatus = requiredEnvVars.map(name => ({
    name,
    set: !!process.env[name]
  }))

  const missingEnvVars = envStatus.filter(e => !e.set)
  const allSet = missingEnvVars.length === 0
  
  const details = envStatus.reduce(
    (acc, { name, set }) => ({ ...acc, [name]: set ? "✅ Set" : "❌ Missing" }),
    {} as Record<string, string>
  )

  return {
    status: allSet ? "success" : "warning",
    message: allSet 
      ? "All required environment variables set" 
      : `Missing: ${missingEnvVars.map(e => e.name).join(", ")}`,
    details
  }
}

// Helper: Check email configuration
function checkEmail(): HealthCheck {
  const hasResend = !!process.env.RESEND_API_KEY
  const hasExchange = !!process.env.EXCHANGE_SERVER
  const hasEmailConfig = hasResend || hasExchange
  
  let message = "No email service configured"
  if (hasResend) message = "Resend email configured"
  else if (hasExchange) message = "Exchange email configured"

  return {
    status: hasEmailConfig ? "success" : "warning",
    message,
    details: {
      resend: hasResend ? "configured" : "not configured",
      exchange: hasExchange ? "configured" : "not configured"
    }
  }
}

// Helper: Determine overall health status
function getOverallStatus(checks: Record<string, HealthCheck>): string {
  const statuses = new Set(Object.values(checks).map(c => c.status))
  if (statuses.has("error")) return "unhealthy"
  if (statuses.has("warning")) return "degraded"
  return "healthy"
}

export async function GET() {
  const checks: Record<string, HealthCheck> = {}

  try {
    // Run all checks
    checks.database = await checkDatabase()
    checks.auth = await checkAuth()
    checks.environment = checkEnvironment()
    checks.email = checkEmail()

    return NextResponse.json({
      status: getOverallStatus(checks),
      timestamp: new Date().toISOString(),
      checks
    })
  } catch (error: any) {
    return NextResponse.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      checks
    }, { status: 500 })
  }
}
