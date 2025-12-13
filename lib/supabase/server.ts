import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"

// Check if we should use the new database adapter
const USE_DATABASE_ADAPTER = process.env.USE_DATABASE_ADAPTER === "true"

export async function createClient() {
  const cookieStore = await cookies()

  if (USE_DATABASE_ADAPTER) {
    return (await createDatabaseClient()) as any
  }

  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            const secureOptions = {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax" as const,
              path: "/",
              domain: undefined,
            }
            cookieStore.set(name, value, secureOptions)
          })
        } catch (error) {
          console.error("[v0] Error setting cookies in server client:", error)
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

export function createServiceClient() {
  if (USE_DATABASE_ADAPTER) {
    return createServiceDatabaseClient() as any
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export { createClient as createServerClient }
export { createClient as createSupabaseServer }
export { createClient as createServerComponentClient }
