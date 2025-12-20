import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

let redis: Redis | null = null
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  }
} catch (error) {
  console.error("Failed to initialize Redis:", error)
}

// GET /api/search/panel/new-count - Lightweight endpoint to check for new sticks count
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get("since")

    if (!since) {
      return NextResponse.json({ error: "Missing 'since' parameter" }, { status: 400 })
    }

    const cacheKey = `panel:new-count:${since}`

    if (redis) {
      try {
        const cached = await redis.get<number>(cacheKey)
        if (cached !== null) {
          return NextResponse.json({ count: Math.min(cached, 9) })
        }
      } catch (error) {
        console.error("[new-count] Redis get error:", error)
      }
    }

    const db = await createDatabaseClient()

    const { count, error } = await db
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("is_shared", true)
      .gt("updated_at", since)
      .limit(9)

    if (error) {
      return NextResponse.json({ count: 0 })
    }

    const newCount = Math.min(count || 0, 9)

    if (redis) {
      try {
        await redis.set(cacheKey, newCount, { ex: 30 })
      } catch (error) {
        console.error("[new-count] Redis set error:", error)
      }
    }

    return NextResponse.json({ count: newCount })
  } catch (error) {
    console.error("[new-count] Error:", error)
    return NextResponse.json({ count: 0 })
  }
}
