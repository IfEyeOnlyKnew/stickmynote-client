"use client"

import { useState, useEffect } from "react"

interface Pad {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  hasAccess: boolean
  hasPendingRequest: boolean
  userRole: string | null
}

export function useBrowseAllPads(open: boolean) {
  const [pads, setPads] = useState<Pad[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAllPads = async () => {
    if (!open) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/pads/browse-all")

      if (!response.ok) {
        throw new Error("Failed to fetch Pads")
      }

      const data = await response.json()
      setPads(data.pads || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch Pads")
    } finally {
      setIsLoading(false)
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    fetchAllPads()
  }, [open])
  /* eslint-enable react-hooks/exhaustive-deps */

  return { pads, isLoading, error, refetch: fetchAllPads }
}
