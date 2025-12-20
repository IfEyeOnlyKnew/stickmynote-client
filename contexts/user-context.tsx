"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

interface User {
  id: string
  email: string
  email_confirmed_at: string | null
}

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
  hub_mode?: "full_access" | null
  login_count?: number
}

interface UserContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  isEmailVerified: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  reloadUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  usePathname() // Keep hook call for potential side effects
  const router = useRouter()

  const fetchUser = async (): Promise<{ user: User | null; profile: UserProfile | null }> => {
    try {
      const response = await fetch("/api/user/me", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.status === 401) {
        return { user: null, profile: null }
      }

      if (!response.ok) {
        throw new Error("Failed to fetch user")
      }

      const data = await response.json()
      return { user: data.user, profile: data.profile }
    } catch (err) {
      console.error("[UserContext] Error fetching user:", err)
      return { user: null, profile: null }
    }
  }

  const refreshProfile = async () => {
    if (!user) return

    try {
      const { user: updatedUser, profile: updatedProfile } = await fetchUser()
      if (updatedProfile) {
        setProfile(updatedProfile)
      }
      if (updatedUser) {
        setUser(updatedUser)
      }
      setError(null)
    } catch (err) {
      console.error("[UserContext] Error refreshing profile:", err)
      setError(null)
    }
  }

  const reloadUser = async () => {
    setLoading(true)
    try {
      const { user: currentUser, profile: currentProfile } = await fetchUser()
      if (currentUser) {
        setUser(currentUser)
        setProfile(currentProfile)
        setError(null)
        setIsEmailVerified(currentUser.email_confirmed_at !== null)
      }
    } catch (err) {
      console.error("[UserContext] Error reloading user:", err)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        setError("Failed to sign out")
      } else {
        setUser(null)
        setProfile(null)
        setError(null)
        setIsEmailVerified(false)
        router.push("/auth/login")
      }
    } catch (err) {
      console.error("[UserContext] Error signing out:", err)
      setError("Failed to sign out")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialized) return

    const initializeAuth = async () => {
      try {
        const { user: currentUser, profile: currentProfile } = await fetchUser()

        if (currentUser) {
          setUser(currentUser)
          setProfile(currentProfile)
          setError(null)
          setIsEmailVerified(currentUser.email_confirmed_at !== null)
        }
      } catch (err) {
        console.error("[UserContext] Error initializing auth:", err)
        setError("Failed to initialize authentication")
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    }

    initializeAuth()
  }, [initialized])

  const value: UserContextType = {
    user,
    profile,
    loading,
    error,
    isEmailVerified,
    signOut,
    refreshProfile,
    reloadUser,
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
