import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const db = await createDatabaseClient()
    const {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { type, config } = await request.json()

    switch (type) {
      case "database":
        return await testDatabaseConnection(config)
      case "smtp":
        return await testSmtpConnection(config)
      case "memcached":
        return await testMemcachedConnection(config)
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

async function testMemcachedConnection(config: any) {
  try {
    const memjs = await import("memjs")
    const servers = config.memcache_servers || `${config.memcached_host || "localhost"}:${config.memcached_port || 11211}`
    const client = memjs.default.Client.create(servers, { timeout: 5 })

    await new Promise<void>((resolve, reject) => {
      client.stats((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    client.close()

    return NextResponse.json({ success: true, message: "Memcached connection successful" })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Memcached connection failed",
    })
  }
}
