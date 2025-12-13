import { NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { redis } from "@/lib/redis/local-redis"
import { emailService } from "@/lib/email/smtp"
import { localStorage } from "@/lib/storage/local-storage"

const USE_LOCAL_DATABASE = process.env.USE_LOCAL_DATABASE === "true"

export async function GET() {
  const checks = {
    deployment: {
      mode: USE_LOCAL_DATABASE ? "Windows Service" : "Vercel Cloud",
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    services: {
      database: { healthy: false, message: "", details: {} },
      redis: { healthy: false, message: "", details: {} },
      email: { healthy: false, message: "", details: {} },
      storage: { healthy: false, message: "", details: {} },
    },
    configuration: {
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      uploadDir: process.env.UPLOAD_DIR,
      useLocalDatabase: USE_LOCAL_DATABASE,
    },
    overall: { healthy: false, message: "" },
  }

  // Check Database
  try {
    if (USE_LOCAL_DATABASE) {
      const dbHealth = await db.healthCheck()
      checks.services.database = {
        healthy: dbHealth.healthy,
        message: dbHealth.message,
        details: {
          host: process.env.POSTGRES_HOST,
          port: process.env.POSTGRES_PORT,
          database: process.env.POSTGRES_DATABASE,
        },
      }
    } else {
      checks.services.database = {
        healthy: true,
        message: "Using Supabase cloud database",
        details: { provider: "Supabase" },
      }
    }
  } catch (error: any) {
    checks.services.database = {
      healthy: false,
      message: `Database error: ${error.message}`,
      details: {},
    }
  }

  // Check Redis
  try {
    const redisHealth = await redis.healthCheck()
    checks.services.redis = {
      healthy: redisHealth.healthy,
      message: redisHealth.message,
      details: {
        usingFallback: redisHealth.usingFallback,
        host: process.env.REDIS_URL?.split("@")[1] || "localhost:6379",
      },
    }
  } catch (error: any) {
    checks.services.redis = {
      healthy: false,
      message: `Redis error: ${error.message}`,
      details: {},
    }
  }

  // Check Email
  try {
    const emailVerified = await emailService.verify()
    checks.services.email = {
      healthy: emailVerified,
      message: emailVerified ? "SMTP connection verified" : "SMTP not configured or unavailable",
      details: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        from: process.env.SMTP_FROM_EMAIL,
      },
    }
  } catch (error: any) {
    checks.services.email = {
      healthy: false,
      message: `Email error: ${error.message}`,
      details: {},
    }
  }

  // Check Storage
  try {
    const storageHealth = await localStorage.healthCheck()
    checks.services.storage = {
      healthy: storageHealth.healthy,
      message: storageHealth.message,
      details: {
        baseDir: process.env.UPLOAD_DIR || "uploads",
      },
    }
  } catch (error: any) {
    checks.services.storage = {
      healthy: false,
      message: `Storage error: ${error.message}`,
      details: {},
    }
  }

  // Overall health
  const allHealthy = Object.values(checks.services).every((service) => service.healthy)
  checks.overall = {
    healthy: allHealthy,
    message: allHealthy ? "All systems operational" : "Some systems require attention",
  }

  return NextResponse.json(checks, {
    status: allHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
