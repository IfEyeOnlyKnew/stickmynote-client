import { NextResponse } from "next/server"
import { getSupabaseServiceClient } from "@/lib/supabase-server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import type { NextRequest } from "next/server"

export async function DELETE(request: NextRequest) {
  // Validate CSRF token for destructive admin operation
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  try {
    const supabase = await getSupabaseServiceClient()

    const results = {
      publicDataCleared: false,
      authUsersDeleted: false,
      errors: [] as string[],
      details: {
        noteTabs: 0,
        replies: 0,
        notes: 0,
        publicUsers: 0,
        authUsers: 0,
      },
    }

    // Step 1: Clear public data in correct order
    try {
      // Delete note_tabs first
      const { error: noteTabsError, count: noteTabsCount } = await supabase
        .from("note_tabs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all

      if (noteTabsError) {
        results.errors.push(`Note tabs deletion error: ${noteTabsError.message}`)
      } else {
        results.details.noteTabs = noteTabsCount || 0
      }

      // Delete replies
      const { error: repliesError, count: repliesCount } = await supabase
        .from("replies")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all

      if (repliesError) {
        results.errors.push(`Replies deletion error: ${repliesError.message}`)
      } else {
        results.details.replies = repliesCount || 0
      }

      // Delete notes
      const { error: notesError, count: notesCount } = await supabase
        .from("notes")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all

      if (notesError) {
        results.errors.push(`Notes deletion error: ${notesError.message}`)
      } else {
        results.details.notes = notesCount || 0
      }

      // Delete public users
      const { error: usersError, count: usersCount } = await supabase
        .from("users")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all

      if (usersError) {
        results.errors.push(`Public users deletion error: ${usersError.message}`)
      } else {
        results.details.publicUsers = usersCount || 0
      }

      results.publicDataCleared = true
    } catch (error) {
      results.errors.push(`Public data cleanup error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    // Step 2: Delete auth users
    try {
      const { data: authUsers, error: fetchError } = await supabase.auth.admin.listUsers()

      if (fetchError) {
        results.errors.push(`Failed to fetch auth users: ${fetchError.message}`)
      } else {
        let deletedCount = 0
        for (const user of authUsers.users) {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
          if (deleteError) {
            results.errors.push(`Failed to delete auth user ${user.email}: ${deleteError.message}`)
          } else {
            deletedCount++
          }
        }
        results.details.authUsers = deletedCount
        results.authUsersDeleted = true
      }
    } catch (error) {
      results.errors.push(`Auth users cleanup error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    return NextResponse.json({
      success: results.publicDataCleared && results.authUsersDeleted && results.errors.length === 0,
      message: "Complete user cleanup attempted",
      results,
      summary: {
        totalDeleted:
          results.details.noteTabs +
          results.details.replies +
          results.details.notes +
          results.details.publicUsers +
          results.details.authUsers,
        errorsCount: results.errors.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to complete user cleanup",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
