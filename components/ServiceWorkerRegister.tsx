"use client"

import { useEffect } from "react"

function handleSwRegistration(registration: ServiceWorkerRegistration) {
  console.log("ServiceWorker registration successful with scope:", registration.scope)

  // Check for updates on page focus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registration.update()
    }
  })
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register service worker in production
    if (process.env.NODE_ENV !== "production") {
      // In development, unregister any existing service workers to prevent caching issues
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister()
          }
        })
      }
      return
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").then(
          handleSwRegistration,
          (err) => {
            console.log("ServiceWorker registration failed:", err)
          },
        )
      })

      // Handle controller change (new SW activated) by reloading
      let refreshing = false
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true
          // Don't auto-reload; the SWUpdateNotification component handles this
        }
      })
    }
  }, [])

  return null
}
