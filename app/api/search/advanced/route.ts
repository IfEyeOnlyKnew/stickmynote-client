import { getSession } from "@/lib/auth/local-auth"
import { NextResponse } from "next/server"
import { executeAdvancedSearch } from "@/lib/handlers/search-advanced-handler"

// POST /api/search/advanced - Advanced search with filters
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const result = await executeAdvancedSearch(session.user.id, body, {
      table: 'notes',
      replyTable: 'replies',
      replyForeignKey: 'note_id',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in advanced search:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
