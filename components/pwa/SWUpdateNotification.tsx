"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function SWUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (globalThis.window === undefined || !("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    // Listen for SW update messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        setShowUpdate(true)
      }
    }
    navigator.serviceWorker.addEventListener("message", handleMessage)

    // Also check for waiting SW on registration
    const handleUpdateFound = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setShowUpdate(true)
          }
        })
      }
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        setRegistration(reg)
        if (reg.waiting) {
          setShowUpdate(true)
        }
        reg.addEventListener("updatefound", () => handleUpdateFound(reg))
      }
    })

    // Check for updates periodically (every 30 minutes)
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update()
      })
    }, 30 * 60 * 1000)

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage)
      clearInterval(interval)
    }
  }, [])

  const handleUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" })
    }
    globalThis.location.reload()
  }, [registration])

  if (!showUpdate) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-lg border bg-card p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
            <RefreshCw className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Update Available</h3>
            <p className="text-xs text-muted-foreground mt-1">
              A new version of Stick My Note is ready. Refresh to get the latest features.
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={handleUpdate} className="h-7 text-xs">
                Refresh Now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowUpdate(false)} className="h-7 text-xs">
                Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
