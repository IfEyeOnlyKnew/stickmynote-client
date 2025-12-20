// v2 How-To-Search API: production-quality, static search help
import { NextRequest } from 'next/server'

// GET /api/v2/how-to-search - Search help
export async function GET(_request: NextRequest) {
  return new Response(
    JSON.stringify({
      help: `Use the search bar to find notes, pads, or sticks by keyword, tag, or content. Advanced filters are available for date, author, and type. For more help, see our documentation.`
    }),
    { status: 200 }
  )
}
