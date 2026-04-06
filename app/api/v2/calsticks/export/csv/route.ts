// v2 Calsticks Export CSV API: production-quality, export tasks as CSV
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { exportCalsticksCsv } from '@/lib/handlers/calsticks-export-csv-handler'
import { rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/export/csv - Export tasks as CSV
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const csvContent = await exportCalsticksCsv(authResult.user.id)

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="calsticks-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
