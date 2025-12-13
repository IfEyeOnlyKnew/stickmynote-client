"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { isPublicEmailDomain } from "@/lib/utils/email-domain"

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

export function useAuthForm(redirectTo = "/dashboard") {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [lockoutInfo, setLockoutInfo] = useState<{
    locked: boolean
    remainingMinutes?: number
    remainingAttempts?: number
  } | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const signIn = async (data: SignInData) => {
    setIsLoading(true)
    setError("")
    setLockoutInfo(null)

    const supabase = createClient()
    const normalizedEmail = data.email.trim().toLowerCase()

    try {
      const lockoutCheck = await fetch("/api/auth/check-lockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      })

      if (lockoutCheck.ok) {
        const lockoutData = await lockoutCheck.json()
        if (lockoutData.locked) {
          setLockoutInfo({
            locked: true,
            remainingMinutes: lockoutData.remainingMinutes,
          })
          setError(
            `Account is temporarily locked. Please try again in ${lockoutData.remainingMinutes} minute${lockoutData.remainingMinutes !== 1 ? "s" : ""}.`,
          )
          toast({
            title: "Account Locked",
            description: `Too many failed login attempts. Please try again in ${lockoutData.remainingMinutes} minute${lockoutData.remainingMinutes !== 1 ? "s" : ""}.`,
            variant: "destructive",
          })
          setIsLoading(false)
          return false
        }
      }

      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: data.password,
      })

      if (signInError) {
        const recordResponse = await fetch("/api/auth/record-attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, success: false }),
        })

        if (recordResponse.ok) {
          const recordData = await recordResponse.json()
          if (recordData.locked) {
            setLockoutInfo({ locked: true, remainingMinutes: Math.ceil(recordData.lockoutMinutes || 15) })
            setError(
              `Account has been locked due to too many failed attempts. Please try again in ${recordData.lockoutMinutes || 15} minutes.`,
            )
            toast({
              title: "Account Locked",
              description: `Too many failed login attempts. Your account has been locked for ${recordData.lockoutMinutes || 15} minutes.`,
              variant: "destructive",
            })
          } else if (recordData.remainingAttempts !== undefined) {
            setLockoutInfo({ locked: false, remainingAttempts: recordData.remainingAttempts })
            const attemptWarning =
              recordData.remainingAttempts <= 2
                ? ` (${recordData.remainingAttempts} attempt${recordData.remainingAttempts !== 1 ? "s" : ""} remaining before lockout)`
                : ""
            setError(`${signInError.message}${attemptWarning}`)
            toast({
              title: "Sign In Failed",
              description: `${signInError.message}${attemptWarning}`,
              variant: "destructive",
            })
          }
        } else {
          setError(signInError.message)
          toast({
            title: "Sign In Failed",
            description: signInError.message,
            variant: "destructive",
          })
        }
        setIsLoading(false)
        return false
      }

      if (authData.user && authData.session) {
        await fetch("/api/auth/record-attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, success: true }),
        })

        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        })

        let finalRedirect = redirectTo

        const { data: userProfile } = await supabase
          .from("users")
          .select("hub_mode")
          .eq("id", authData.user.id)
          .single()

        const userEmail = authData.user.email || data.email
        const isPersonalEmail = isPublicEmailDomain(userEmail)

        if (!isPersonalEmail) {
          const domain = userEmail.split("@")[1]?.toLowerCase()
          if (domain) {
            try {
              const membershipRes = await fetch(`/api/organizations/check-membership?domain=${domain}`)
              if (membershipRes.ok) {
                const membershipData = await membershipRes.json()

                if (membershipData.hasOrganization && !membershipData.isMember) {
                  toast({
                    title: "Organization Access Required",
                    description: membershipData.hasPendingRequest
                      ? "Your access request is pending approval."
                      : `You need to request access to ${membershipData.organization?.name} to use full features.`,
                    duration: 8000,
                  })
                }
              }
            } catch (err) {
              // Non-critical - continue with login
            }
          }
        }

        let effectiveHubMode = userProfile?.hub_mode
        if (!effectiveHubMode) {
          effectiveHubMode = isPersonalEmail ? "personal_only" : "full_access"
        }

        if (effectiveHubMode === "personal_only") {
          finalRedirect = "/notes"
        } else if (effectiveHubMode === "full_access") {
          finalRedirect = "/dashboard"
        }

        router.push(finalRedirect)
        return true
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
    return false
  }

  const signUp = async (data: SignUpData) => {
    setIsLoading(true)
    setError("")

    const supabase = createClient()

    if (data.password !== data.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return false
    }

    if (data.password.length < 6) {
      setError("Password must be at least 6 characters long")
      setIsLoading(false)
      return false
    }

    if (!data.fullName.trim()) {
      setError("Full name is required")
      setIsLoading(false)
      return false
    }

    if (!data.username.trim()) {
      setError("Username is required")
      setIsLoading(false)
      return false
    }

    try {
      const redirectUrl = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`

      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: data.username.trim(),
            full_name: data.fullName.trim(),
            phone: data.phone?.trim() || "",
            location: data.location?.trim() || "",
            bio: data.bio?.trim() || "",
            website: data.website?.trim() || "",
            avatar_url: data.avatarUrl?.trim() || "",
          },
        },
      })

      if (error) {
        let userMessage = error.message
        if (
          error.message.includes("rate limit") ||
          error.message.includes("429") ||
          error.message.includes("Too Many Requests") ||
          error.message.includes("Email rate limit exceeded")
        ) {
          userMessage =
            "Too many sign-up attempts. Please wait a few minutes and try again, or contact support if this persists."
        } else if (error.message.includes("confirmation email") || error.message.includes("sending email")) {
          userMessage =
            "Your account was created! We're sending you a verification email. If you don't receive it, please try signing in."
        } else if (error.message.includes("already registered")) {
          userMessage = "This email is already registered. Please sign in instead or use a different email."
        } else if (error.message.includes("invalid email")) {
          userMessage = "Please enter a valid email address."
        } else if (error.message.includes("password")) {
          userMessage = "Password must be at least 6 characters with a mix of letters and numbers."
        }

        setError(userMessage)
        toast({
          title: "Sign Up Failed",
          description: userMessage,
          variant: "destructive",
          duration: 8000,
        })
        return false
      }

      if (authData.user) {
        try {
          const emailResponse = await fetch("/api/send-verification-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: data.email.trim(),
              fullName: data.fullName.trim(),
              userId: authData.user.id,
            }),
          })

          const emailResult = await emailResponse.json()

          if (!emailResponse.ok) {
            toast({
              title: "Account created!",
              description:
                "Your account was created successfully. If you don't receive a verification email, please try signing in.",
              duration: 10000,
            })
          } else {
            toast({
              title: "Account created successfully!",
              description: "Please check your email inbox for a verification link to complete your registration.",
              duration: 10000,
            })
          }
        } catch (emailErr) {
          toast({
            title: "Account created!",
            description:
              "Your account was created successfully. If you don't receive a verification email, please try signing in.",
            duration: 10000,
          })
        }

        return true
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
    return false
  }

  const resetPassword = async (data: ResetPasswordData) => {
    setIsLoading(true)
    setError("")

    const supabase = createClient()

    if (!data.email.trim()) {
      setError("Please enter your email address")
      setIsLoading(false)
      return false
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password/confirm`,
      })

      if (error) {
        setError(error.message)
        toast({
          title: "Reset Failed",
          description: error.message,
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
      setError("An unexpected error occurred. Please try again.")
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
    return false
  }

  return {
    isLoading,
    error,
    lockoutInfo,
    signIn,
    signUp,
    resetPassword,
  }
}
