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

    // Fetch initial sticks  direct database query
    const notesResult = await db.query(
      `SELECT * FROM personal_sticks
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    )

    const rawNotes = notesResult.rows || []

    // Get note IDs to fetch related tabs (hyperlinks)
    const noteIds = rawNotes.map((n: { id: string }) => n.id)

    // Fetch tabs that contain hyperlinks
    let tabsMap = new Map<string, { url: string; title?: string }[]>()
    // Fetch replies for all notes
    let repliesMap = new Map<string, any[]>()

    if (noteIds.length > 0) {
      const tabsResult = await db.query(
        `SELECT personal_stick_id, tab_name, tags
         FROM personal_sticks_tabs
         WHERE personal_stick_id = ANY($1) AND tab_name = 'Tags'`,
        [noteIds]
      )

      for (const tab of tabsResult.rows || []) {
        if (tab.tags) {
          try {
            const hyperlinks = typeof tab.tags === 'string'
              ? JSON.parse(tab.tags)
              : tab.tags
            tabsMap.set(tab.personal_stick_id, hyperlinks)
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Fetch replies with user info (include parent_reply_id for threading)
      const repliesResult = await db.query(
        `SELECT r.id, r.content, r.color, r.created_at, r.updated_at, r.user_id, r.personal_stick_id, r.parent_reply_id,
                u.full_name, u.email
         FROM personal_sticks_replies r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.personal_stick_id = ANY($1)
         ORDER BY r.created_at ASC`,
        [noteIds]
      )

      for (const reply of repliesResult.rows || []) {
        const arr = repliesMap.get(reply.personal_stick_id) || []
        arr.push({
          id: reply.id,
          content: reply.content || "",
          color: reply.color || "#ffffff",
          created_at: reply.created_at,
          updated_at: reply.updated_at || reply.created_at,
          user_id: reply.user_id,
          note_id: reply.personal_stick_id,
          parent_reply_id: reply.parent_reply_id || null,
          user: {
            username: reply.full_name || null,
            email: reply.email || null,
          },
        })
        repliesMap.set(reply.personal_stick_id, arr)
      }
    }

    // Merge hyperlinks and replies into notes
    const initialNotes: Note[] = rawNotes.map((note: any) => ({
      ...note,
      hyperlinks: tabsMap.get(note.id) || [],
      replies: repliesMap.get(note.id) || [],
    }))

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
