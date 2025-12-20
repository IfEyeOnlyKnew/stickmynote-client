/**
 * Personal page (server component)
 *
 * Route: /personal (Next.js App Router)
 * Responsibility:
 *  - Enforce authentication (redirect unauthenticated users to /auth/login)
 *  - Fetch initial notes (first page) for the current user for fast TTFB/SSR
 *  - Compute lightweight note stats and pass them to the client
 *  - Hydrate the client UI via <NotesClient /> with initial data
 *
 * Contract (inputs/outputs):
 *  - Inputs are implicit via request context (cookies/headers for JWT auth)
 *  - Output: JSX that renders the Notes dashboard via <NotesClient />
 *
 * Error handling:
 *  - Logs server-side errors; rethrows to let Next.js handle the error boundary
 *  - Non-fatal fetch issues fall back to empty arrays/default stats
 */
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { NotesClient } from "./NotesClient"
import type { Note } from "@/types/note"

export default async function NotesPage() {
  try {
    // Get session from JWT cookie
    const session = await getSession()

    // Redirect to login if not authenticated
    if (!session?.user) {
      redirect("/auth/login")
    }

    const userId = session.user.id

    // Fetch initial notes using direct database query
    const notesResult = await db.query(
      `SELECT * FROM personal_sticks 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId]
    )

    const initialNotes: Note[] = notesResult.rows || []

    // Get counts
    const countResult = await db.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE is_shared = true) as shared
       FROM personal_sticks 
       WHERE user_id = $1`,
      [userId]
    )

    const total = Number.parseInt(countResult.rows[0]?.total || "0", 10)
    const shared = Number.parseInt(countResult.rows[0]?.shared || "0", 10)
    
    const stats = {
      total,
      personal: total - shared,
      shared,
    }

    // Hydrate the client component with SSR-fetched data for fast, interactive UX
    return <NotesClient initialNotes={initialNotes} userId={userId} stats={stats} />
  } catch (error) {
    // Let Next.js error boundary handle this; keep logs for observability
    console.error("Error in NotesPage server component:", error)
    throw error
  }
}
