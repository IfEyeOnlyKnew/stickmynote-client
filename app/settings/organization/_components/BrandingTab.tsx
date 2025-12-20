"use client"

import type React from "react"
import { useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Trash2, Upload } from "lucide-react"

interface BrandingSettings {
  logo_url: string
  logo_dark_url: string
  favicon_url: string
  page_logo_url: string
  primary_color: string
  secondary_color: string
  accent_color: string
  organization_display_name: string
}

interface BrandingTabProps {
  brandingSettings: BrandingSettings
  uploadingLogo: boolean
  canManageSettings: boolean
  saving: boolean
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "logo_dark" | "favicon" | "page_logo") => void
  handleBrandingChange: (type: string) => void
  handleBrandingSettingsUpdate: () => void
}

export function BrandingTab({
  brandingSettings,
  uploadingLogo,
  canManageSettings,
  saving,
  handleLogoUpload,
  handleBrandingChange,
  handleBrandingSettingsUpdate,
}: Readonly<BrandingTabProps>) {
  const logoInputRef = useRef<HTMLInputElement>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Customize how your organization appears across the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label>Logo (Light Mode)</Label>
            <div className="flex items-center gap-4 mt-2">
              {brandingSettings.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandingSettings.logo_url || "/placeholder.svg"}
                  alt="Logo"
                  className="h-12 w-auto rounded border bg-white p-1"
                />
              ) : (
                <div className="h-12 w-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
                  No logo
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoUpload(e, "logo")}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo || !canManageSettings}
              >
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="ml-2">Upload</span>
              </Button>
              {brandingSettings.logo_url && canManageSettings && (
                <Button variant="ghost" size="sm" onClick={() => handleBrandingChange("logo")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <Button onClick={handleBrandingSettingsUpdate} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Branding
        </Button>
      </CardContent>
    </Card>
  )
}
