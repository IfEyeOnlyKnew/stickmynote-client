"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StickyNote, Users, Check, AlertCircle, Info } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { extractDomain, isPublicEmailDomain } from "@/lib/utils/email-domain"

interface HubModeSelectorProps {
  open: boolean
  onComplete: (mode: "personal_only" | "full_access") => void
  userId: string
  userEmail: string
}

export function HubModeSelector({ open, onComplete, userId, userEmail }: HubModeSelectorProps) {
  const domain = extractDomain(userEmail)
  const isPersonalEmail = !domain || isPublicEmailDomain(domain)
  const suggestedMode = isPersonalEmail ? "personal_only" : "full_access"

  const [selectedMode, setSelectedMode] = useState<"personal_only" | "full_access" | null>(suggestedMode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!selectedMode) {
      setSelectedMode(suggestedMode)
    }
  }, [suggestedMode, selectedMode])

  const handleSave = async () => {
    if (!selectedMode) return

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      if (selectedMode === "full_access") {
        if (isPersonalEmail) {
          setError(
            "Public email domains (gmail.com, outlook.com, etc.) cannot be used for organization access. Please use your company email address or select Personal Hub Only.",
          )
          setSaving(false)
          return
        }

        const response = await fetch("/api/organizations/find-or-create-by-domain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (data.isPublic) {
            setError(
              "Public email domains (gmail.com, yahoo.com, etc.) cannot be used for organizations. Please use your company email address.",
            )
            setSaving(false)
            return
          }
          throw new Error(data.error || "Failed to setup organization")
        }
      }

      // Update user's hub_mode preference
      const { error: updateError } = await supabase.from("users").update({ hub_mode: selectedMode }).eq("id", userId)

      if (updateError) {
        console.error("Error saving hub mode:", updateError)
        setError("Failed to save preference. Please try again.")
        setSaving(false)
        return
      }

      // Call the onComplete callback
      onComplete(selectedMode)

      // Redirect based on choice
      if (selectedMode === "personal_only") {
        router.push("/notes")
      } else {
        router.push("/dashboard")
      }
    } catch (err) {
      console.error("Error in handleSave:", err)
      setError(err instanceof Error ? err.message : "Failed to save preference. Please try again.")
      setSaving(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-4xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Welcome to Stick My Note!</DialogTitle>
          <DialogDescription className="text-center text-base">
            Choose how you'd like to use the application. You can change this anytime in your profile settings.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Based on your email domain ({domain || "unknown"}), we suggest{" "}
            <strong>{suggestedMode === "personal_only" ? "Personal Hub Only" : "Full Organization Access"}</strong>.
            {isPersonalEmail
              ? " Personal email domains are best suited for individual use."
              : " Corporate email domains can access team collaboration features."}
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6 my-6">
          {/* Personal Only Mode */}
          <Card
            className={`cursor-pointer transition-all duration-200 ${
              selectedMode === "personal_only"
                ? "border-yellow-500 border-2 shadow-lg bg-yellow-50"
                : "hover:border-yellow-300 hover:shadow-md"
            }`}
            onClick={() => setSelectedMode("personal_only")}
          >
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <StickyNote className="h-10 w-10 text-yellow-600" />
              </div>
              <CardTitle className="text-xl flex items-center justify-center gap-2">
                Personal Hub Only
                {selectedMode === "personal_only" && <Check className="h-5 w-5 text-yellow-600" />}
              </CardTitle>
              <CardDescription>Simple and focused note-taking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-start text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
                  <span>Create and manage personal sticky notes</span>
                </div>
                <div className="flex items-start text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
                  <span>Private by default, share when you want</span>
                </div>
                <div className="flex items-start text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
                  <span>Rich media support (images, videos)</span>
                </div>
                <div className="flex items-start text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></div>
                  <span>AI-powered tag generation</span>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500 italic">
                  Perfect for individuals who want a simple, distraction-free note-taking experience.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Full Access Mode */}
          <Card
            className={`cursor-pointer transition-all duration-200 ${
              selectedMode === "full_access"
                ? "border-blue-500 border-2 shadow-lg bg-blue-50"
                : isPersonalEmail
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:border-blue-300 hover:shadow-md"
            }`}
            onClick={() => {
              if (!isPersonalEmail) {
                setSelectedMode("full_access")
              }
            }}
          >
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Users className="h-10 w-10 text-blue-600" />
              </div>
              <CardTitle className="text-xl flex items-center justify-center gap-2">
                Full Organization Access
                {selectedMode === "full_access" && <Check className="h-5 w-5 text-blue-600" />}
              </CardTitle>
              <CardDescription>
                {isPersonalEmail ? "Requires corporate email" : "Complete team collaboration suite"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-start text-sm">
                  <div
                    className={`w-2 h-2 ${isPersonalEmail ? "bg-gray-400" : "bg-blue-500"} rounded-full mr-2 mt-1.5 flex-shrink-0`}
                  ></div>
                  <span className={isPersonalEmail ? "text-gray-400" : ""}>
                    <strong>Personal Hub</strong> - Your private notes
                  </span>
                </div>
                <div className="flex items-start text-sm">
                  <div
                    className={`w-2 h-2 ${isPersonalEmail ? "bg-gray-400" : "bg-blue-500"} rounded-full mr-2 mt-1.5 flex-shrink-0`}
                  ></div>
                  <span className={isPersonalEmail ? "text-gray-400" : ""}>
                    <strong>Paks Hub</strong> - Team workspaces & projects
                  </span>
                </div>
                <div className="flex items-start text-sm">
                  <div
                    className={`w-2 h-2 ${isPersonalEmail ? "bg-gray-400" : "bg-blue-500"} rounded-full mr-2 mt-1.5 flex-shrink-0`}
                  ></div>
                  <span className={isPersonalEmail ? "text-gray-400" : ""}>
                    <strong>Social Hub</strong> - Enterprise collaboration
                  </span>
                </div>
                <div className="flex items-start text-sm">
                  <div
                    className={`w-2 h-2 ${isPersonalEmail ? "bg-gray-400" : "bg-blue-500"} rounded-full mr-2 mt-1.5 flex-shrink-0`}
                  ></div>
                  <span className={isPersonalEmail ? "text-gray-400" : ""}>
                    Automatic team matching by email domain
                  </span>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500 italic">
                  {isPersonalEmail
                    ? "This option requires a corporate email address (e.g., you@company.com)."
                    : `Your email domain (${domain}) will determine your organization. Team members with the same domain will automatically join your organization.`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Button onClick={handleSave} disabled={!selectedMode || saving} size="lg" className="px-12">
            {saving ? "Setting up..." : selectedMode ? "Continue" : "Select a mode to continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
