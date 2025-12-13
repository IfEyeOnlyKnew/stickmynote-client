import { createClient } from "./supabase/client"

// Export for backwards compatibility
export const createSupabaseBrowser = createClient
export const getSupabaseBrowser = createClient

export default createClient
