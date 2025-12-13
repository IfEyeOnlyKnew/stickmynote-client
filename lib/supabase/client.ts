import { createBrowserClient } from "@supabase/ssr"

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  return browserClient
}

export function resetClient() {
  browserClient = null
}

export function isRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const errorObj = error as { message?: string; code?: string }
  return (
    errorObj.message?.includes("Refresh Token") ||
    errorObj.message?.includes("refresh_token") ||
    errorObj.code === "refresh_token_not_found"
  )
}
