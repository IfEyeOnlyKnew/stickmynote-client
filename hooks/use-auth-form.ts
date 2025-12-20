"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

// ============================================================================
// Types
// ============================================================================

export interface SignInData {
  email: string
  password: string
}

export interface SignUpData {
  email: string
  password: string
  confirmPassword: string
  fullName: string
  username: string
  phone?: string
  location?: string
  bio?: string
  website?: string
  avatarUrl?: string
}

export interface ResetPasswordData {
  email: string
}

interface LockoutInfo {
  locked: boolean
  remainingMinutes?: number
  remainingAttempts?: number
}

interface AuthState {
  isLoading: boolean
  error: string
  lockoutInfo: LockoutInfo | null
}

interface LockoutCheckResponse {
  locked: boolean
  remainingMinutes?: number
}

interface SignInResponse {
  success?: boolean
  user?: { id: string; email?: string }
  error?: string
  locked?: boolean
  remainingMinutes?: number
}

interface SignUpResponse {
  success?: boolean
  user?: { id: string }
  error?: string
}

interface MembershipResponse {
  hasOrganization?: boolean
  isMember?: boolean
  hasPendingRequest?: boolean
  organization?: { name: string }
}

// ============================================================================
// Constants
// ============================================================================

const MIN_PASSWORD_LENGTH = 6
const TOAST_DURATION_LONG = 8000
const TOAST_DURATION_EXTRA_LONG = 10000

const FETCH_OPTIONS = {
  credentials: "include" as RequestCredentials,
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
}

// ============================================================================
// Helpers
// ============================================================================

async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/csrf", {
      method: "GET",
      ...FETCH_OPTIONS,
    })
    if (!response.ok) {
      console.error("[AuthForm] Failed to fetch CSRF token")
      return null
    }
    const data = await response.json()
    return data.csrfToken
  } catch (err) {
    console.error("[AuthForm] CSRF token fetch error:", err)
    return null
  }
}

function buildAuthHeaders(csrfToken: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...JSON_HEADERS }
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken
  }
  return headers
}

function formatLockoutMessage(minutes: number): string {
  const plural = minutes !== 1 ? "s" : ""
  return `Account is temporarily locked. Please try again in ${minutes} minute${plural}.`
}

function formatLockoutToastMessage(minutes: number): string {
  const plural = minutes !== 1 ? "s" : ""
  return `Too many failed login attempts. Please try again in ${minutes} minute${plural}.`
}

function extractDomainFromEmail(email: string): string | null {
  const parts = email.split("@")
  return parts.length > 1 ? parts[1].toLowerCase() : null
}

// ============================================================================
// Validation
// ============================================================================

interface ValidationResult {
  valid: boolean
  error?: string
}

function validateSignUpData(data: SignUpData): ValidationResult {
  if (data.password !== data.confirmPassword) {
    return { valid: false, error: "Passwords do not match" }
  }

  if (data.password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` }
  }

  if (!data.fullName.trim()) {
    return { valid: false, error: "Full name is required" }
  }

  if (!data.username.trim()) {
    return { valid: false, error: "Username is required" }
  }

  return { valid: true }
}

function validateResetPasswordData(data: ResetPasswordData): ValidationResult {
  if (!data.email.trim()) {
    return { valid: false, error: "Please enter your email address" }
  }
  return { valid: true }
}

// ============================================================================
// API Calls
// ============================================================================

async function checkLockoutStatus(email: string): Promise<LockoutCheckResponse | null> {
  try {
    const response = await fetch("/api/auth/check-lockout", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email }),
    })

    if (response.ok) {
      return await response.json()
    }
  } catch {
    // Non-critical - continue with sign in
  }
  return null
}

async function checkOrganizationMembership(
  domain: string
): Promise<{ show: boolean; message?: string; title?: string }> {
  try {
    const response = await fetch(`/api/organizations/check-membership?domain=${domain}`)
    if (response.ok) {
      const data: MembershipResponse = await response.json()

      if (data.hasOrganization && !data.isMember) {
        const message = data.hasPendingRequest
          ? "Your access request is pending approval."
          : `You need to request access to ${data.organization?.name} to use full features.`

        return { show: true, message, title: "Organization Access Required" }
      }
    }
  } catch {
    // Non-critical - continue with login
  }
  return { show: false }
}

async function sendVerificationEmail(email: string, fullName: string, userId: string): Promise<void> {
  try {
    await fetch("/api/send-verification-email", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, fullName, userId }),
    })
  } catch {
    // Non-critical - user is created successfully
  }
}

type SignInResult =
  | { success: true; user: { id: string; email?: string }; email: string }
  | { success: false; error: string; locked?: boolean; remainingMinutes?: number }

async function performSignIn(
  email: string,
  password: string
): Promise<SignInResult> {
  // Check lockout status first
  const lockoutData = await checkLockoutStatus(email)
  if (lockoutData?.locked) {
    const minutes = lockoutData.remainingMinutes || 1
    return {
      success: false,
      error: formatLockoutMessage(minutes),
      locked: true,
      remainingMinutes: minutes,
    }
  }

  // Fetch CSRF token
  const csrfToken = await fetchCSRFToken()
  if (!csrfToken) {
    return {
      success: false,
      error: "Security token could not be obtained. Please refresh the page and try again.",
    }
  }

  // Call sign in API
  const response = await fetch("/api/auth/signin", {
    method: "POST",
    headers: buildAuthHeaders(csrfToken),
    ...FETCH_OPTIONS,
    body: JSON.stringify({ email, password }),
  })

  const data: SignInResponse = await response.json()

  if (!response.ok) {
    return {
      success: false,
      error: data.error || "Invalid credentials",
      locked: data.locked,
      remainingMinutes: data.remainingMinutes,
    }
  }

  if (data.success && data.user) {
    return { success: true, user: data.user, email }
  }

  return { success: false, error: "Sign in failed" }
}

async function handlePostSignInRedirect(
  user: { id: string; email?: string },
  originalEmail: string
): Promise<{ redirect: string; membership?: { title: string; message: string }; isFirstLogin?: boolean; isOwner?: boolean }> {
  const userEmail = user.email || originalEmail

  let membership: { title: string; message: string } | undefined

  // Check organization membership
  const domain = extractDomainFromEmail(userEmail)
  if (domain) {
    const membershipCheck = await checkOrganizationMembership(domain)
    if (membershipCheck.show && membershipCheck.title && membershipCheck.message) {
      membership = { title: membershipCheck.title, message: membershipCheck.message }
    }
  }

  // Call post-login API to update login count and get redirect
  try {
    const response = await fetch("/api/auth/post-login", {
      method: "POST",
      ...FETCH_OPTIONS,
    })
    
    if (response.ok) {
      const data = await response.json()
      return { 
        redirect: data.redirect || "/dashboard", 
        membership,
        isFirstLogin: data.isFirstLogin,
        isOwner: data.isOwner
      }
    }
  } catch {
    // Non-critical - fall back to dashboard
  }

  return { redirect: "/dashboard", membership }
}

// ============================================================================
// Hook
// ============================================================================

export function useAuthForm(redirectTo = "/dashboard") {
  const [state, setState] = useState<AuthState>({
    isLoading: false,
    error: "",
    lockoutInfo: null,
  })

  const router = useRouter()
  const { toast } = useToast()

  const setLoading = useCallback((isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }))
  }, [])

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, error }))
  }, [])

  const setLockoutInfo = useCallback((lockoutInfo: LockoutInfo | null) => {
    setState((prev) => ({ ...prev, lockoutInfo }))
  }, [])

  const resetState = useCallback(() => {
    setState({ isLoading: true, error: "", lockoutInfo: null })
  }, [])

  const signIn = useCallback(
    async (data: SignInData): Promise<boolean> => {
      resetState()

      const normalizedEmail = data.email.trim().toLowerCase()

      try {
        const result = await performSignIn(normalizedEmail, data.password)

        if (!result.success) {
          const title = result.locked ? "Account Locked" : "Sign In Failed"
          const description = result.locked
            ? formatLockoutToastMessage(result.remainingMinutes || 1)
            : result.error

          if (result.locked) {
            setLockoutInfo({ locked: true, remainingMinutes: result.remainingMinutes })
          }

          setError(result.error)
          toast({ title, description, variant: "destructive" })
          setLoading(false)
          return false
        }

        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        })

        const postSignIn = await handlePostSignInRedirect(result.user, result.email)

        if (postSignIn.membership) {
          toast({
            title: postSignIn.membership.title,
            description: postSignIn.membership.message,
            duration: TOAST_DURATION_LONG,
          })
        }

        const finalRedirect = postSignIn.redirect === "/dashboard" ? redirectTo : postSignIn.redirect
        router.push(finalRedirect)
        return true
      } catch (err) {
        console.error("[AuthForm] Sign in error:", err)
        setError("An unexpected error occurred. Please try again.")
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
      return false
    },
    [resetState, setLockoutInfo, setError, setLoading, toast, router, redirectTo]
  )

  const signUp = useCallback(
    async (data: SignUpData): Promise<boolean> => {
      resetState()

      // Validate input
      const validation = validateSignUpData(data)
      if (!validation.valid) {
        setError(validation.error!)
        setLoading(false)
        return false
      }

      try {
        // Fetch CSRF token
        const csrfToken = await fetchCSRFToken()
        if (!csrfToken) {
          setError("Security token could not be obtained. Please refresh the page and try again.")
          toast({
            title: "Security Error",
            description: "Please refresh the page and try again.",
            variant: "destructive",
          })
          setLoading(false)
          return false
        }

        // Call sign up API
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: buildAuthHeaders(csrfToken),
          ...FETCH_OPTIONS,
          body: JSON.stringify({
            email: data.email.trim(),
            password: data.password,
            fullName: data.fullName.trim(),
            username: data.username.trim(),
            phone: data.phone?.trim() || "",
            location: data.location?.trim() || "",
            bio: data.bio?.trim() || "",
            website: data.website?.trim() || "",
            avatarUrl: data.avatarUrl?.trim() || "",
          }),
        })

        const signUpData: SignUpResponse = await response.json()

        if (!response.ok) {
          let userMessage = signUpData.error || "Failed to create account"

          if (signUpData.error?.includes("already exists")) {
            userMessage = "This email is already registered. Please sign in instead or use a different email."
          }

          setError(userMessage)
          toast({
            title: "Sign Up Failed",
            description: userMessage,
            variant: "destructive",
            duration: TOAST_DURATION_LONG,
          })
          return false
        }

        if (signUpData.success && signUpData.user) {
          toast({
            title: "Account created successfully!",
            description: "You can now sign in with your email and password.",
            duration: TOAST_DURATION_EXTRA_LONG,
          })

          // Try to send verification email (non-blocking)
          await sendVerificationEmail(data.email.trim(), data.fullName.trim(), signUpData.user.id)

          return true
        }
      } catch (err) {
        console.error("[AuthForm] Sign up error:", err)
        setError("An unexpected error occurred. Please try again.")
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
      return false
    },
    [resetState, setError, setLoading, toast]
  )

  const resetPassword = useCallback(
    async (data: ResetPasswordData): Promise<boolean> => {
      resetState()

      // Validate input
      const validation = validateResetPasswordData(data)
      if (!validation.valid) {
        setError(validation.error!)
        setLoading(false)
        return false
      }

      try {
        const csrfToken = await fetchCSRFToken()

        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: buildAuthHeaders(csrfToken),
          ...FETCH_OPTIONS,
          body: JSON.stringify({ email: data.email.trim() }),
        })

        const result = await response.json()

        if (!response.ok) {
          setError(result.error || "Failed to send reset email")
          toast({
            title: "Reset Failed",
            description: result.error || "Failed to send reset email",
            variant: "destructive",
          })
          return false
        }

        toast({
          title: "Check your email",
          description: "We sent you a password reset link. Please check your email.",
        })
        return true
      } catch (err) {
        console.error("[AuthForm] Reset password error:", err)
        setError("An unexpected error occurred. Please try again.")
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
      return false
    },
    [resetState, setError, setLoading, toast]
  )

  return {
    isLoading: state.isLoading,
    error: state.error,
    lockoutInfo: state.lockoutInfo,
    signIn,
    signUp,
    resetPassword,
  }
}
