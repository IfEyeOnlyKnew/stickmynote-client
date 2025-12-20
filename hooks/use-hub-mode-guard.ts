"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

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
      try {
        // Use local API to check auth status
        const authResponse = await fetch("/api/auth/session")
        const authData = await authResponse.json()

        if (!authData.user) {
          router.replace("/auth/login")
          return
        }

        // Fetch user profile via API
        const profileResponse = await fetch("/api/user/profile")
        if (!profileResponse.ok) {
          console.error("useHubModeGuard - Error fetching profile")
          setIsAuthorized(true)
          setIsLoading(false)
          return
        }

        const profile = await profileResponse.json()
        const userHubMode = profile?.hub_mode || "personal_only"
        setHubMode(userHubMode)

        const currentPath = window.location.pathname
        const isFullAccessRoute = FULL_ACCESS_ROUTES.some((route) => currentPath.startsWith(route))

        if (userHubMode === "personal_only" && isFullAccessRoute) {
          router.replace("/personal")
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
