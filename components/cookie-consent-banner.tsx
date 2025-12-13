"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Cookie, Settings } from "lucide-react"
import Link from "next/link"

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem("cookie-consent")
    if (!consent) {
      setShowBanner(true)
    } else {
      const savedPreferences = JSON.parse(consent)
      setPreferences(savedPreferences)
      applyConsent(savedPreferences)
    }
  }, [])

  const applyConsent = (prefs: typeof preferences) => {
    // Apply analytics consent
    if (prefs.analytics) {
      // Enable analytics tracking
      if (typeof window !== "undefined" && (window as any).gtag) {
        ;(window as any).gtag("consent", "update", {
          analytics_storage: "granted",
        })
      }
    } else {
      // Disable analytics tracking
      if (typeof window !== "undefined" && (window as any).gtag) {
        ;(window as any).gtag("consent", "update", {
          analytics_storage: "denied",
        })
      }
    }

    // Apply marketing consent
    if (prefs.marketing) {
      if (typeof window !== "undefined" && (window as any).gtag) {
        ;(window as any).gtag("consent", "update", {
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
        })
      }
    } else {
      if (typeof window !== "undefined" && (window as any).gtag) {
        ;(window as any).gtag("consent", "update", {
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
        })
      }
    }
  }

  const handleAcceptAll = () => {
    const newPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
    }
    setPreferences(newPreferences)
    localStorage.setItem("cookie-consent", JSON.stringify(newPreferences))
    applyConsent(newPreferences)
    setShowBanner(false)
  }

  const handleRejectAll = () => {
    const newPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
    }
    setPreferences(newPreferences)
    localStorage.setItem("cookie-consent", JSON.stringify(newPreferences))
    applyConsent(newPreferences)
    setShowBanner(false)
  }

  const handleSavePreferences = () => {
    localStorage.setItem("cookie-consent", JSON.stringify(preferences))
    applyConsent(preferences)
    setShowBanner(false)
    setShowSettings(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-black/50 backdrop-blur-sm">
      <Card className="max-w-4xl mx-auto p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Cookie Preferences</h3>
              {!showSettings ? (
                <p className="text-sm text-muted-foreground">
                  We use cookies to enhance your experience, analyze site traffic, and personalize content. By clicking
                  "Accept All", you consent to our use of cookies.{" "}
                  <Link href="/privacy" className="text-blue-600 hover:underline">
                    Learn more
                  </Link>
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Necessary Cookies</p>
                        <p className="text-xs text-muted-foreground">Required for the website to function properly</p>
                      </div>
                      <input type="checkbox" checked disabled className="h-4 w-4" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Analytics Cookies</p>
                        <p className="text-xs text-muted-foreground">Help us understand how visitors use our site</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Marketing Cookies</p>
                        <p className="text-xs text-muted-foreground">Used to deliver personalized advertisements</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowBanner(false)} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {!showSettings ? (
            <>
              <Button onClick={handleAcceptAll} className="flex-1 sm:flex-none">
                Accept All
              </Button>
              <Button onClick={handleRejectAll} variant="outline" className="flex-1 sm:flex-none bg-transparent">
                Reject All
              </Button>
              <Button
                onClick={() => setShowSettings(true)}
                variant="outline"
                className="flex-1 sm:flex-none flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Customize
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleSavePreferences} className="flex-1 sm:flex-none">
                Save Preferences
              </Button>
              <Button onClick={() => setShowSettings(false)} variant="outline" className="flex-1 sm:flex-none">
                Back
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
