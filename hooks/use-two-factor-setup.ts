"use client"

import { useState } from "react"
import { getCsrfToken } from "@/lib/client-csrf"
import QRCode from "qrcode"

export interface TwoFactorSetupState {
  qrCodeDataUrl: string
  secret: string
  backupCodes: string[]
  code: string
  error: string
  loading: boolean
  copiedSecret: boolean
  copiedCodes: boolean
}

export function useTwoFactorSetup() {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("")
  const [secret, setSecret] = useState<string>("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  async function startSetup() {
    setLoading(true)
    setError("")

    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Setup failed")
      }

      const data = await response.json()
      setSecret(data.secret)
      setBackupCodes(data.backupCodes)

      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(data.qrCodeUri)
      setQrCodeDataUrl(qrDataUrl)

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
      return false
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code")
      return false
    }

    setLoading(true)
    setError("")

    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch("/api/auth/2fa/verify-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Verification failed")
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
      setCode("")
      return false
    } finally {
      setLoading(false)
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  function resetState() {
    setCode("")
    setError("")
    setQrCodeDataUrl("")
    setSecret("")
    setBackupCodes([])
    setCopiedSecret(false)
    setCopiedCodes(false)
  }

  return {
    // State
    qrCodeDataUrl,
    secret,
    backupCodes,
    code,
    error,
    loading,
    copiedSecret,
    copiedCodes,
    // Setters
    setCode,
    // Actions
    startSetup,
    verifyCode,
    copySecret,
    copyBackupCodes,
    resetState,
  }
}
