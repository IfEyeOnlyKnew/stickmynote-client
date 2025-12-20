// v2 Terms API: production-quality, static terms of service
import { NextRequest } from 'next/server'

// GET /api/v2/terms - Terms of service
export async function GET(_request: NextRequest) {
  return new Response(
    JSON.stringify({
      terms: `By using StickMyNote, you agree to comply with all applicable laws and enterprise policies. Unauthorized access or misuse of data is strictly prohibited. For full terms, see our website.`
    }),
    { status: 200 }
  )
}
