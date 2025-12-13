import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: { orgId: string } }) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { type, config } = await request.json()

    switch (type) {
      case "database":
        return await testDatabaseConnection(config)
      case "smtp":
        return await testSmtpConnection(config)
      case "redis":
        return await testRedisConnection(config)
      default:
        return NextResponse.json({ error: "Invalid connection type" }, { status: 400 })
    }
  } catch (error) {
    console.error("[v0] Error testing connection:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Connection test failed" },
      { status: 500 },
    )
  }
}

async function testDatabaseConnection(config: any) {
  try {
    const { Client } = await import("pg")
    const client = new Client({
      host: config.postgres_host,
      port: config.postgres_port,
      database: config.postgres_database,
      user: config.postgres_user,
      password: config.postgres_password,
      connectionTimeoutMillis: 5000,
    })

    await client.connect()
    await client.query("SELECT NOW()")
    await client.end()

    return NextResponse.json({ success: true, message: "Database connection successful" })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Database connection failed",
    })
  }
}

async function testSmtpConnection(config: any) {
  try {
    const nodemailer = await import("nodemailer")
    const transporter = nodemailer.default.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_port === 465,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    await transporter.verify()

    return NextResponse.json({ success: true, message: "SMTP connection successful" })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "SMTP connection failed",
    })
  }
}

async function testRedisConnection(config: any) {
  try {
    const { createClient } = await import("redis")
    const client = createClient({
      socket: {
        host: config.redis_host,
        port: config.redis_port,
        connectTimeout: 5000,
      },
      password: config.redis_password || undefined,
      database: config.redis_database,
    })

    await client.connect()
    await client.ping()
    await client.quit()

    return NextResponse.json({ success: true, message: "Redis connection successful" })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Redis connection failed",
    })
  }
}
