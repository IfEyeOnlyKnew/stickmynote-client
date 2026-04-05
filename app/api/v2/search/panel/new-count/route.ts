// v2 Search Panel New Count API: production-quality, check for new sticks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// Optional Redis for caching
let redis: any = null
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    import('@upstash/redis').then((module) => {
      redis = new module.Redis({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
      })
    }).catch(() => {})
  }
} catch {
  // Redis is optional — caching will be skipped if unavailable
}

// GET /api/v2/search/panel/new-count - Check for new sticks count
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    if (!since) {
      return new Response(JSON.stringify({ error: "Missing 'since' parameter" }), { status: 400 })
    }

    const cacheKey = `panel:new-count:${since}`

    // Check cache
    if (redis) {
      try {
        const cached = await redis.get(cacheKey)
        if (cached !== null) {
          return new Response(JSON.stringify({ count: Math.min(Number(cached), 9) }), { status: 200 })
        }
      } catch {
        // Cache read failed — fall through to database query
      }
    }

    // Query database
    const result = await db.query(
      `SELECT COUNT(*) FROM personal_sticks
       WHERE is_shared = true AND updated_at > $1
       LIMIT 9`,
      [since]
    )

    const newCount = Math.min(Number.parseInt(result.rows[0]?.count || '0', 10), 9)

    // Cache result
    if (redis) {
      try {
        await redis.set(cacheKey, newCount, { ex: 30 })
      } catch {
        // Non-critical — cache write is best-effort
      }
    }

    return new Response(JSON.stringify({ count: newCount }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
