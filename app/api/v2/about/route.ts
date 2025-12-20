// v2 About API: production-quality, static app info
import { NextRequest } from 'next/server'

// GET /api/v2/about - App info
export async function GET(_request: NextRequest) {
  return new Response(
    JSON.stringify({
      name: 'StickMyNote',
      version: '2.0',
      description: 'Enterprise note, pad, and stick management platform',
      copyright: '© 2025 StickMyNote',
      website: 'https://stickmynote.com'
    }),
    { status: 200 }
  )
}
