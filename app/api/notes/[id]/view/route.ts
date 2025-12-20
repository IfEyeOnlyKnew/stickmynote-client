import type { NextRequest } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Only "note_created", "note_updated", "reply_added" are allowed
  // To re-enable, add "view" to the personal_sticks_activities_activity_type_check constraint
  return new Response(JSON.stringify({ success: true, message: "View tracking disabled" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

  /*
  // NOTE: If re-enabling, use local auth and PostgreSQL:
  // import { getSession } from "@/lib/auth/session"
  // import { createDatabaseClient } from "@/lib/database/database-adapter"
  //
  // const session = await getSession()
  // if (!session?.user) { return Response.json({ error: "Unauthorized" }, { status: 401 }) }
  // const db = await createDatabaseClient()
  // const { error } = await db.from("personal_sticks_activities").insert({...})
  */
}
