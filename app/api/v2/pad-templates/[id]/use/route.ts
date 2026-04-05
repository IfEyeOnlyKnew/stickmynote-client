// v2 Pad Templates Use API: production-quality, increment use count
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'

export const dynamic = 'force-dynamic'

// POST /api/v2/pad-templates/[id]/use - Increment template use count
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch current use count
    const result = await db.query(
      `SELECT use_count FROM paks_pad_templates WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      // Don't fail the request - just return success
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    const currentCount = result.rows[0].use_count || 0

    // Update use count
    await db.query(
      `UPDATE paks_pad_templates SET use_count = $1 WHERE id = $2`,
      [currentCount + 1, id]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    // Don't fail the request on errors - just log
    console.error('Error incrementing pad template use count:', error)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
}
