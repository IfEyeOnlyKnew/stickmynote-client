"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Cookie, Settings } from "lucide-react"
import Link from "next/link"

interface CookiePreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
}

const ALL_ACCEPTED: CookiePreferences = {
  necessary: true,
  analytics: true,
  marketing: true,
}

// Helper: Update gtag consent
function updateGtagConsent(consentType: string, value: "granted" | "denied") {
  if (globalThis.window === undefined) return
  const gtag = (globalThis as any).gtag
  if (!gtag) return
  gtag("consent", "update", { [consentType]: value })
}

// Helper: Apply analytics consent
function applyAnalyticsConsent(enabled: boolean) {
  updateGtagConsent("analytics_storage", enabled ? "granted" : "denied")
}

// Helper: Apply marketing consent
function applyMarketingConsent(enabled: boolean) {
  if (globalThis.window === undefined) return
  const gtag = (globalThis as any).gtag
  if (!gtag) return
  const value = enabled ? "granted" : "denied"
  gtag("consent", "update", {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  })
}

// Helper: Apply all consent preferences
function applyConsent(prefs: CookiePreferences) {
  applyAnalyticsConsent(prefs.analytics)
  applyMarketingConsent(prefs.marketing)
}

// Helper: Save preferences to localStorage
function savePreferences(prefs: CookiePreferences) {
  localStorage.setItem("cookie-consent", JSON.stringify(prefs))
  applyConsent(prefs)
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent")
    if (!consent) {
      setShowBanner(true)
      return
    }
    const savedPreferences = JSON.parse(consent)
    setPreferences(savedPreferences)
    applyConsent(savedPreferences)
  }, [])

  const handleAcceptAll = () => {
    setPreferences(ALL_ACCEPTED)
    savePreferences(ALL_ACCEPTED)
    setShowBanner(false)
  }

  const handleRejectAll = () => {
    setPreferences(DEFAULT_PREFERENCES)
    savePreferences(DEFAULT_PREFERENCES)
    setShowBanner(false)
  }

  const handleSavePreferences = () => {
    savePreferences(preferences)
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
              {showSettings ? (
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
              ) : (
                <p className="text-sm text-muted-foreground">
                  We use cookies to enhance your experience, analyze site traffic, and personalize content. By clicking
                  &quot;Accept All&quot;, you consent to our use of cookies.{" "}
                  <Link href="/privacy" className="text-blue-600 hover:underline">
                    Learn more
                  </Link>
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowBanner(false)} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {showSettings ? (
            <>
              <Button onClick={handleSavePreferences} className="flex-1 sm:flex-none">
                Save Preferences
              </Button>
              <Button onClick={() => setShowSettings(false)} variant="outline" className="flex-1 sm:flex-none">
                Back
              </Button>
            </>
          ) : (
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
          )}
        </div>
      </Card>
    </div>
  )
}
