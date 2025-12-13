"use client"

import { useMemo } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Client-side hook to access Supabase client
 * Returns a memoized Supabase client instance
 */
export function useSupabase() {
  const supabase = useMemo(() => createClient(), [])

  return { supabase }
}
