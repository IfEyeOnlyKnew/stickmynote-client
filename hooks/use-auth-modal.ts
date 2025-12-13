"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export type AuthModalTab = "signin" | "signup" | "reset"

interface UseAuthModalProps {
  initialMode?: AuthModalTab
  onSuccess?: () => void
}

export function useAuthModal({ initialMode = "signin", onSuccess }: UseAuthModalProps = {}) {
  const [activeTab, setActiveTab] = useState<AuthModalTab>(initialMode)
  const router = useRouter()

  const handleTabChange = (value: string, isAccessCodeVerified: boolean) => {
    if ((value === "signup" || value === "reset") && !isAccessCodeVerified) {
      return false // Tab change blocked
    }

    if (value === "signin" || value === "signup" || value === "reset") {
      setActiveTab(value as AuthModalTab)
      return true
    }
    return false
  }

  const handleAuthSuccess = () => {
    onSuccess?.()
    router.push("/dashboard")
  }

  return {
    activeTab,
    setActiveTab,
    handleTabChange,
    handleAuthSuccess,
  }
}
