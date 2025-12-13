"use client"

import { useEffect, useState } from "react"

export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCSRFToken() {
      try {
        setLoading(true)
        const response = await fetch("/api/csrf", {
          method: "GET",
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Failed to fetch CSRF token")
        }

        const data = await response.json()
        setCSRFToken(data.csrfToken)
        setError(null)
      } catch (err) {
        console.error("CSRF token fetch error:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchCSRFToken()
  }, [])

  return { csrfToken, loading, error }
}
