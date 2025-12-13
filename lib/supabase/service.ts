import { createClient } from "@supabase/supabase-js"

let serviceClient: ReturnType<typeof createClient> | null = null

/**
 * Creates or returns a singleton Supabase service client with admin privileges.
 * Uses the service role key for server-side operations that bypass RLS.
 */
export function createServiceClient() {
  if (serviceClient) {
    return serviceClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role credentials")
  }

  serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return serviceClient
}

// Alias for backward compatibility
export const getServiceClient = createServiceClient
