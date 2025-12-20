// v2 Config-Check API: production-quality, system config status
import { NextRequest } from 'next/server'
import { handleApiError } from '@/lib/api/handle-api-error'
import { checkDatabase, checkAD, checkSMTP } from '@/lib/api/config-check-helpers'

// GET /api/v2/config-check - System config status
export async function GET(_request: NextRequest) {
  try {
    const db = await checkDatabase()
    const ad = await checkAD()
    const smtp = await checkSMTP()
    return new Response(
      JSON.stringify({
        database: db,
        activeDirectory: ad,
        smtp: smtp
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
