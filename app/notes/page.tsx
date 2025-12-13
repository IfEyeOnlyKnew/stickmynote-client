/**
 * Notes page (server component)
 *
 * Route: /notes (Next.js App Router)
 * Responsibility:
 *  - Enforce authentication (redirect unauthenticated users to /auth/login)
 *  - Fetch initial notes (first page) for the current user for fast TTFB/SSR
 *  - Compute lightweight note stats and pass them to the client
 *  - Hydrate the client UI via <NotesClient /> with initial data
 *
 * Contract (inputs/outputs):
 *  - Inputs are implicit via request context (cookies/headers for Supabase auth)
 *  - Output: JSX that renders the Notes dashboard via <NotesClient />
 *
 * Error handling:
 *  - Logs server-side errors; rethrows to let Next.js handle the error boundary
 *  - Non-fatal fetch issues fall back to empty arrays/default stats
 */
import { redirect } from "next/navigation"
import { createSupabaseServer } from "@/lib/supabase-server"
import { NotesClient } from "./NotesClient"
import type { Note } from "@/types/note"

export default async function NotesPage() {
  try {
    // Initialize a Supabase server client bound to the current request
    const supabase = await createSupabaseServer()

    // Resolve current user from server-side auth context
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // Redirect to login if not authenticated
    if (authError || !user) {
      redirect("/auth/login")
    }

    // Client will load more via infinite scroll
    const { data: notesData, error: notesError } = await supabase
      .from("personal_sticks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (notesError) {
      console.error("Error fetching notes:", notesError)
    }

    const initialNotes: Note[] = notesData || []

    const { count: totalCount, error: countError } = await supabase
      .from("personal_sticks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    const { count: sharedCount, error: sharedCountError } = await supabase
      .from("personal_sticks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_shared", true)

    if (countError) {
      console.error("Error fetching total count:", countError)
    }
    if (sharedCountError) {
      console.error("Error fetching shared count:", sharedCountError)
    }

    // Derive counts for total/personal/shared using count queries instead of fetching all data
    const total = totalCount || 0
    const shared = sharedCount || 0
    const stats = {
      total,
      personal: total - shared,
      shared,
    }

    // Hydrate the client component with SSR-fetched data for fast, interactive UX
    return <NotesClient initialNotes={initialNotes} userId={user.id} stats={stats} />
  } catch (error) {
    // Let Next.js error boundary handle this; keep logs for observability
    console.error("Error in NotesPage server component:", error)
    throw error
  }
}
