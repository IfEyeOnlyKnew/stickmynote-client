"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// ============================================================================
// Types
// ============================================================================

interface ConcurGroupSettingsDialogProps {
  groupId: string
  groupName: string
  currentLogoUrl: string | null
  currentHeaderImageUrl: string | null
  onClose: () => void
  onUpdated: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ConcurGroupSettingsDialog({
  groupId,
  groupName,
  currentLogoUrl,
  currentHeaderImageUrl,
  onClose,
  onUpdated,
}: Readonly<ConcurGroupSettingsDialogProps>) {
  const { toast } = useToast()
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl || "")
  const [headerImageUrl, setHeaderImageUrl] = useState(currentHeaderImageUrl || "")
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const [saving, setSaving] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const headerInputRef = useRef<HTMLInputElement>(null)
  // Track old URLs to delete only on save (not during upload)
  const urlsToDelete = useRef<string[]>([])

  const handleUpload = async (
    file: File,
    currentUrl: string,
    setUrl: (url: string) => void,
    setUploading: (v: boolean) => void
  ) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "destructive" })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "media")
      formData.append("noEncrypt", "true")

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()

      // Queue old file for deletion on save
      if (currentUrl) urlsToDelete.current.push(currentUrl)
      setUrl(data.url)
    } catch {
      toast({ title: "Failed to upload image", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (currentUrl: string, setUrl: (url: string) => void) => {
    if (currentUrl) urlsToDelete.current.push(currentUrl)
    setUrl("")
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/concur/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: logoUrl || null,
          header_image_url: headerImageUrl || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")

      // Delete old files only after successful save
      for (const url of urlsToDelete.current) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }).catch(() => {})
      }
      urlsToDelete.current = []

      toast({ title: "Group settings updated" })
      onUpdated()
      onClose()
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group Settings</DialogTitle>
          <DialogDescription>
            Customize the appearance of {groupName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Logo Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Group Logo <span className="text-muted-foreground font-normal">(56 x 56px)</span>
            </Label>
            {logoUrl ? (
              <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                <img
                  src={logoUrl}
                  alt="Group logo"
                  className="w-20 h-20 rounded-lg object-cover border shadow-sm"
                />
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">Logo uploaded</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      Replace
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(logoUrl, setLogoUrl)}
                      className="text-red-500 hover:text-red-700 hover:border-red-300"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-3 rounded-lg border border-dashed">
                <div className="w-20 h-20 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
                  <ImageIcon className="h-8 w-8" />
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Upload Logo
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Square image recommended. JPG, PNG, GIF, or WebP. Max 5MB.
                  </p>
                </div>
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              aria-label="Upload group logo"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file, logoUrl, setLogoUrl, setUploadingLogo)
                e.target.value = ""
              }}
            />
          </div>

          {/* Header Image Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Header Image <span className="text-muted-foreground font-normal">(144px height)</span>
            </Label>
            {headerImageUrl ? (
              <div className="relative">
                <img
                  src={headerImageUrl}
                  alt="Group header banner"
                  className="w-full h-36 rounded-lg object-cover border"
                />
                <button
                  type="button"
                  title="Remove header image"
                  onClick={() => handleRemove(headerImageUrl, setHeaderImageUrl)}
                  className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="w-full h-36 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 mx-auto mb-1" />
                  <span className="text-xs">No header image</span>
                </div>
              </div>
            )}
            <input
              ref={headerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              aria-label="Upload header image"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file, headerImageUrl, setHeaderImageUrl, setUploadingHeader)
                e.target.value = ""
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => headerInputRef.current?.click()}
              disabled={uploadingHeader}
            >
              {uploadingHeader ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload Header Image
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Wide banner image, displayed at 144px height. JPG, PNG, GIF, or WebP. Max 5MB.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploadingLogo || uploadingHeader}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
