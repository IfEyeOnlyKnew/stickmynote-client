// v2 Deploy-Guide API: production-quality, static deployment guide
import { NextRequest } from 'next/server'

// GET /api/v2/deploy-guide - Deployment guide
export async function GET(_request: NextRequest) {
  return new Response(
    JSON.stringify({
      guide: `To deploy StickMyNote, follow the enterprise deployment checklist. Ensure PostgreSQL, Active Directory, and Exchange are configured. See the full deployment guide on our website for step-by-step instructions.`
    }),
    { status: 200 }
  )
}
