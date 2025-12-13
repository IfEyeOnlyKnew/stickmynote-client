"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient, resetClient, isRefreshTokenError } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"
import { setSentryUser, addSentryBreadcrumb } from "@/lib/sentry-utils"

interface UserProfile {
  id: string
  email: string
  username?: string | null
  bio?: string | null
  website?: string | null
  location?: string | null
  full_name?: string | null
  avatar_url?: string | null
  phone?: string | null
  organize_notes?: boolean
  created_at?: string
  updated_at?: string
  hub_mode?: "personal_only" | "full_access" | null
}

interface UserContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  isEmailVerified: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  const pathname = usePathname()
  const router = useRouter()

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("users").select("*").eq("id", userId).single()

      if (error) {
        if (error.code === "PGRST116") {
          return null
        }
        return null
      }

      return data as UserProfile
    } catch (err) {
      return null
    }
  }

  const refreshProfile = async () => {
    if (!user) return

    try {
      const userProfile = await fetchUserProfile(user.id)
      setProfile(userProfile)
      setError(null)
    } catch (err) {
      setError(null)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        setError("Failed to sign out")
      } else {
        setUser(null)
        setProfile(null)
        setError(null)
        setIsEmailVerified(false)
        setSentryUser(null)
        addSentryBreadcrumb("User signed out", "auth", "info")
      }
    } catch (err) {
      setError("Failed to sign out")
    } finally {
      setLoading(false)
    }
  }

  const handleAuthError = async (error: unknown) => {
    if (isRefreshTokenError(error)) {
      addSentryBreadcrumb("Refresh token error - signing out", "auth", "warning")
      resetClient()
      setUser(null)
      setProfile(null)
      setError(null)
      setIsEmailVerified(false)
      setSentryUser(null)
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // Ignore sign out errors
      }
      const redirectPath = pathname || "/"
      router.push(`/auth/login?redirect=${encodeURIComponent(redirectPath)}&session_expired=true`)
      return true
    }
    return false
  }

  useEffect(() => {
    if (initialized) return

    const supabase = createClient()

    const initializeAuth = async () => {
      try {
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          const handled = await handleAuthError(userError)
          if (handled) return
        }

        if (currentUser) {
          setUser(currentUser)
          setError(null)
          setIsEmailVerified(currentUser.email_confirmed_at !== null)
          setSentryUser(currentUser)
          addSentryBreadcrumb("User session initialized", "auth", "info", {
            userId: currentUser.id,
          })
        }
      } catch (err) {
        await handleAuthError(err)
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: { user: User } | null) => {
      if (event === "TOKEN_REFRESHED" && !session) {
        await handleAuthError({ message: "Refresh Token Not Found" })
        return
      }

      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user)
        setError(null)
        setIsEmailVerified(session.user.email_confirmed_at !== null)
        setLoading(false)
        setInitialized(true)
        setSentryUser(session.user)
        addSentryBreadcrumb("User signed in", "auth", "info", {
          userId: session.user.id,
        })
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfile(null)
        setError(null)
        setIsEmailVerified(false)
        setLoading(false)
        setSentryUser(null)
        addSentryBreadcrumb("User signed out", "auth", "info")
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setUser(session.user)
      } else if (event === "INITIAL_SESSION") {
        if (session?.user) {
          setUser(session.user)
          setError(null)
          setIsEmailVerified(session.user.email_confirmed_at !== null)
          setSentryUser(session.user)
          addSentryBreadcrumb("User session restored", "auth", "info", {
            userId: session.user.id,
          })
        }
        setLoading(false)
        setInitialized(true)
      }
    })

    initializeAuth()

    return () => {
      subscription.unsubscribe()
    }
  }, [initialized, pathname, router])

  useEffect(() => {
    if (user && !profile && initialized && !loading) {
      refreshProfile()
    }
  }, [user, initialized, loading, profile])

  const value: UserContextType = {
    user,
    profile,
    loading,
    error,
    isEmailVerified,
    signOut,
    refreshProfile,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

export default UserProvider
