"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient, resetClient, isRefreshTokenError } from "@/lib/supabase/client"
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
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handleAuthError = async (err: unknown) => {
      if (isRefreshTokenError(err)) {
        resetClient()
        setUser(null)
        setError(null)
        try {
          const supabase = createClient()
          await supabase.auth.signOut()
        } catch {
          // Ignore
        }
        const redirectPath = pathname || "/"
        router.push(`/auth/login?redirect=${encodeURIComponent(redirectPath)}&session_expired=true`)
        return true
      }
      return false
    }

    const getInitialSession = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        if (error) {
          const handled = await handleAuthError(error)
          if (!handled) {
            setError(error.message)
          }
        } else {
          setUser(user ?? null)
        }
      } catch (err) {
        const handled = await handleAuthError(err)
        if (!handled) {
          setError(err instanceof Error ? err.message : "Authentication error")
        }
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: { user: any } | null) => {
      setUser(session?.user ?? null)
      setLoading(false)
      setError(null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, pathname])

  return { user, loading, error }
}
