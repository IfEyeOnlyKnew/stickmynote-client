// v2 Privacy API: production-quality, static privacy policy
import { NextRequest } from 'next/server'

// GET /api/v2/privacy - Privacy policy
export async function GET(_request: NextRequest) {
  return new Response(
    JSON.stringify({
      policy: `Your privacy is important to us. We do not share your data with third parties except as required for enterprise authentication and compliance. All data is encrypted in transit and at rest. For full details, see our website.`
    }),
    { status: 200 }
  )
}
