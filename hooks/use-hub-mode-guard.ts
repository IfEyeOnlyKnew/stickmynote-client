"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

const FULL_ACCESS_ROUTES = [
  "/dashboard",
  "/social",
  "/control-panel",
  "/tags",
  "/mysticks",
  "/mypads",
  "/calsticks",
  "/quicksticks",
  "/video",
  "/paks",
  "/settings/organization",
]

export function useHubModeGuard() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hubMode, setHubMode] = useState<string | null>(null)

  useEffect(() => {
    async function checkAccess() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          router.replace("/auth/login")
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("hub_mode")
          .eq("id", user.id)
          .single()

        if (profileError) {
          console.error("useHubModeGuard - Error fetching profile:", profileError.message)
          setIsAuthorized(true)
          setIsLoading(false)
          return
        }

        const userHubMode = profile?.hub_mode || "personal_only"
        setHubMode(userHubMode)

        const currentPath = window.location.pathname
        const isFullAccessRoute = FULL_ACCESS_ROUTES.some((route) => currentPath.startsWith(route))

        if (userHubMode === "personal_only" && isFullAccessRoute) {
          router.replace("/notes")
          return
        }

        setIsAuthorized(true)
      } catch (error) {
        console.error("useHubModeGuard - Error:", error)
        setIsAuthorized(true)
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [router])

  return {
    isAuthorized,
    isLoading,
    hubMode,
    isFullAccess: hubMode === "full_access",
    isPersonalOnly: hubMode === "personal_only",
  }
}
