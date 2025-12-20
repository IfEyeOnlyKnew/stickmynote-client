"use client"

import { useEffect, useState } from "react"
import type { User } from "@/types/auth-compat"
import { useRouter, usePathname } from "next/navigation"

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const getUser = async () => {
      try {
        const response = await fetch("/api/user/current")
        
        if (response.status === 401) {
          // Not authenticated - redirect to login
          setUser(null)
          const redirectPath = pathname || "/"
          router.push(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`)
          return
        }
        
        if (!response.ok) {
          const data = await response.json()
          setError(data.error || "Authentication error")
          setUser(null)
          return
        }

        const data = await response.json()
        setUser(data.user ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authentication error")
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [router, pathname])

  return { user, loading, error }
}
