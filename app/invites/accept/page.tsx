"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/contexts/UserContext"
import { Loader2 } from "lucide-react"

type InviteStatus = "checking" | "processing" | "error" | "email_mismatch" | "expired"

interface ProcessTokenResult {
  success: boolean
  status?: InviteStatus
  orgId?: string
  inviteEmail?: string
  userEmail?: string
  error?: string
}

async function processTokenInvite(token: string): Promise<ProcessTokenResult> {
  const response = await fetch("/api/invites/accept-by-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })

  const data = await response.json()

  if (!response.ok) {
    if (data.code === "EMAIL_MISMATCH") {
      return { success: false, status: "email_mismatch", inviteEmail: data.inviteEmail, userEmail: data.userEmail }
    }
    if (data.code === "EXPIRED") {
      return { success: false, status: "expired" }
    }
    return { success: false, error: data.error || "Failed to process invitation" }
  }

  return { success: true, orgId: data.orgId }
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()
  type InviteStatus = "checking" | "processing" | "error" | "email_mismatch" | "expired"
  const [status, setStatus] = useState<InviteStatus>("checking")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [inviteDetails, setInviteDetails] = useState<{
    email?: string
    userEmail?: string
    organizationName?: string
  }>({})

  useEffect(() => {
    if (userLoading) return
    
    const handleInvitation = async () => {
      const token = searchParams.get("token")
      const redirectTo = searchParams.get("redirectTo") || "/"

      if (!user) {
        // Not logged in - redirect to login with return URL and token
        console.log("[v0] User not logged in, redirecting to login")
        const loginRedirect = token ? `/invites/accept?token=${token}` : `/invites/accept?redirectTo=${redirectTo}`
        router.push(`/auth/login?redirectTo=${encodeURIComponent(loginRedirect)}`)
        return
      }

      // User is logged in - process invites
      console.log("[v0] User logged in, processing invites")
      setStatus("processing")

      try {
        if (token) {
          const result = await processTokenInvite(token)

          if (result.status === "email_mismatch") {
            setStatus("email_mismatch")
            setInviteDetails({ email: result.inviteEmail, userEmail: result.userEmail })
            return
          }
          if (result.status === "expired") {
            setStatus("expired")
            return
          }
          if (!result.success) {
            throw new Error(result.error)
          }

          // Redirect to organization dashboard
          router.push(`/dashboard?org=${result.orgId}&welcome=true`)
          return
        }

        // Process all pending invites (original flow)
        const response = await fetch("/api/invites/process", {
          method: "POST",
        })

        if (!response.ok) {
          throw new Error("Failed to process invitations")
        }

        const data = await response.json()
        console.log("[v0] Invites processed:", data)

        // Redirect to the intended destination
        router.push(redirectTo)
      } catch (error) {
        console.error("[v0] Error processing invites:", error)
        setStatus("error")
        setErrorMessage(error instanceof Error ? error.message : "Failed to process invitation. Please try again.")
      }
    }

    handleInvitation()
  }, [router, searchParams, user, userLoading])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md text-center">
        {status === "checking" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Checking authentication...</p>
          </>
        )}
        {status === "processing" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Processing your invitation...</p>
          </>
        )}
        {status === "email_mismatch" && (
          <div className="rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-xl font-bold text-destructive">Email Mismatch</h2>
            <p className="mt-4 text-muted-foreground">
              This invitation was sent to <strong>{inviteDetails.email}</strong>, but you&apos;re logged in as{" "}
              <strong>{inviteDetails.userEmail}</strong>.
            </p>
            <p className="mt-2 text-muted-foreground">
              Please log in with the correct email address to accept this invitation.
            </p>
            <button
              onClick={() => router.push("/auth/login")}
              className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Switch Account
            </button>
          </div>
        )}
        {status === "expired" && (
          <div className="rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-xl font-bold text-destructive">Invitation Expired</h2>
            <p className="mt-4 text-muted-foreground">
              This invitation has expired. Please ask the organization administrator to send a new invitation.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Go to Dashboard
            </button>
          </div>
        )}
        {status === "error" && (
          <div className="rounded-lg border bg-destructive/10 p-6">
            <p className="text-destructive">{errorMessage}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90"
            >
              Go to Home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
