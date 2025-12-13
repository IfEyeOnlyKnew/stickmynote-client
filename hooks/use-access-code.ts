"use client"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

async function verifyAccessCode(code: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/verify-login-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      credentials: "include",
    })
    const data = await res.json()
    return { ok: !!data.ok, message: data.message }
  } catch (err) {
    console.error("Access code verification error:", err)
    return { ok: false, message: "Unable to verify access code. Please try again." }
  }
}

async function checkVerificationStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/verify-login-code", {
      method: "GET",
      credentials: "include",
    })
    const data = await res.json()
    return !!data.verified
  } catch (err) {
    console.error("Error checking verification status:", err)
    return false
  }
}

export function useAccessCode() {
  const [accessCode, setAccessCode] = useState("")
  const [isAccessCodeVerified, setIsAccessCodeVerified] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [error, setError] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    checkVerificationStatus().then((verified) => {
      setIsAccessCodeVerified(verified)
      setIsCheckingStatus(false)
    })
  }, [])

  const handleAccessCodeChange = async (value: string) => {
    setAccessCode(value)
    setError("")

    if (value.length === 6) {
      const { ok, message } = await verifyAccessCode(value.trim())

      if (ok) {
        setIsAccessCodeVerified(true)
        toast({
          title: "Access Code Verified",
          description: "You can now access all features.",
        })
      } else {
        setIsAccessCodeVerified(false)
        setError(message || "Invalid access code.")
        toast({
          title: "Access denied",
          description: message || "Invalid access code.",
          variant: "destructive",
        })
      }
    } else {
      setIsAccessCodeVerified(false)
    }
  }

  return {
    accessCode,
    setAccessCode,
    isAccessCodeVerified,
    isCheckingStatus,
    error,
    handleAccessCodeChange,
  }
}
