// v2 Community API: production-quality, static community info
import { NextRequest } from 'next/server'

// GET /api/v2/community - Community info
export async function GET(_request: NextRequest) {
  return new Response(
    JSON.stringify({
      community: `Join the StickMyNote community for support, feature requests, and best practices. Visit our forums or contact support for more information.`
    }),
    { status: 200 }
  )
}
