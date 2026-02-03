"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useUser } from "@/contexts/user-context"
import { useCSRF } from "@/hooks/useCSRF"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  XCircle,
  Save,
  RefreshCw,
  User,
  Home,
  Download,
  Trash2,
  AlertTriangle,
  Clock,
} from "lucide-react"
import { TimezoneSelector } from "@/components/settings/timezone-selector"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

type Profile = {
  id: string
  email: string | null
  username: string | null
  full_name: string | null
  bio: string | null
  website: string | null
  phone: string | null
  location: string | null
  avatar_url: string | null
  organize_notes: boolean | null
  timezone: string | null
  created_at?: string | null
  updated_at?: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile: contextProfile, loading: userLoading, refreshProfile: refreshUserContext } = useUser()
  const { csrfToken } = useCSRF()
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Initialize local profile state from context
  useEffect(() => {
    if (contextProfile) {
      setProfile({
        id: contextProfile.id,
        email: contextProfile.email || null,
        username: contextProfile.username || null,
        full_name: contextProfile.full_name || null,
        bio: contextProfile.bio || null,
        website: contextProfile.website || null,
        phone: contextProfile.phone || null,
        location: contextProfile.location || null,
        avatar_url: contextProfile.avatar_url || null,
        organize_notes: contextProfile.organize_notes ?? null,
        timezone: (contextProfile as any).timezone || null,
        created_at: contextProfile.created_at || null,
        updated_at: contextProfile.updated_at || null,
      })
    }
  }, [contextProfile])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: profile.username,
          full_name: profile.full_name,
          bio: profile.bio,
          website: profile.website,
          phone: profile.phone,
          location: profile.location,
          organize_notes: profile.organize_notes ?? false,
          timezone: profile.timezone,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update profile")
      }

      // Refresh the user context to reflect changes
      await refreshUserContext()
      setSuccess("Your profile changes have been saved.")
    } catch (e: any) {
      setError(e?.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    if (file.size > 2 * 1024 * 1024) {
      setError("File size must be less than 2MB")
      e.target.value = ""
      return
    }

    setUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/avatar-upload", {
        method: "POST",
        headers: {
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Upload failed")
      }

      const { url } = await response.json()
      setProfile({ ...profile, avatar_url: url })
      setSuccess("Avatar uploaded successfully!")
    } catch (error: any) {
      setError(error.message || "Failed to upload avatar")
    } finally {
      setUploadingAvatar(false)
      e.target.value = ""
    }
  }

  const handleExportData = async () => {
    setExporting(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch("/api/export-data")
      if (!response.ok) {
        throw new Error("Failed to export data")
      }

      const blob = await response.blob()
      const url = globalThis.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `stickmynote-data-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      globalThis.URL.revokeObjectURL(url)
      a.remove()

      setSuccess("Your data has been exported successfully!")
    } catch (e: any) {
      setError(e?.message || "Failed to export data")
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch("/api/delete-account", {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete account")
      }

      router.push("/")
    } catch (e: any) {
      setError(e?.message || "Failed to delete account")
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Profile", current: true },
          ]}
        />

        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/personal")}
            className="inline-flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>View and update your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading profile...
              </div>
            )}

            {!userLoading && !user && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>You must be signed in to view your profile.</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {!userLoading && user && profile && (
              <>
                <form onSubmit={saveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email (managed by IT)</Label>
                      <Input id="email" value={profile.email ?? ""} disabled />
                      <p className="text-xs text-gray-500 mt-1">
                        Email and password are managed through your organization&apos;s directory.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profile.phone ?? ""}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        inputMode="tel"
                        placeholder="e.g. +1 555 123 4567"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">User Name</Label>
                      <Input
                        id="username"
                        value={profile.username ?? ""}
                        onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={profile.full_name ?? ""}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        maxLength={100}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="website">Web site</Label>
                      <Input
                        id="website"
                        value={profile.website ?? ""}
                        onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                        placeholder="https://"
                        inputMode="url"
                      />
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={profile.location ?? ""}
                        onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                        placeholder="City, State/Country"
                        maxLength={100}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Timezone
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Used for displaying meeting times and scheduling
                    </p>
                    <TimezoneSelector
                      value={profile.timezone || "America/New_York"}
                      onChange={(value) => setProfile({ ...profile, timezone: value })}
                      showAutoDetect
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={profile.bio ?? ""}
                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                        maxLength={300}
                        rows={4}
                      />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="avatar">Avatar</Label>
                        <div className="space-y-3">
                          {profile.avatar_url && (
                            <div className="flex items-center gap-3">
                              <Image
                                src={profile.avatar_url || "/placeholder.svg"}
                                alt="Current avatar"
                                width={64}
                                height={64}
                                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                              />
                              <div className="text-sm text-gray-600">Current avatar</div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Input
                              id="avatar"
                              type="file"
                              accept="image/*"
                              onChange={handleAvatarUpload}
                              disabled={uploadingAvatar}
                              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            {uploadingAvatar && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Uploading...
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Upload an image file (JPEG, PNG, GIF, WebP). Max size: 2MB
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving} className="flex items-center gap-2">
                      {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.push("/personal")} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </form>

                <div className="pt-6 border-t space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Data & Privacy</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage your data and account in compliance with GDPR and CCPA regulations.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <Download className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">Download Your Data</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Export all your data including notes, replies, tags, pads, and sticks in JSON format.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleExportData}
                          disabled={exporting}
                          className="flex items-center gap-2 bg-transparent"
                        >
                          {exporting ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              Download My Data
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium mb-1 text-red-900">Delete Your Account</h4>
                        <p className="text-sm text-red-700 mb-3">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={deleting}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete My Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Account Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This action will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Your profile and account information</li>
                <li>All your notes and replies</li>
                <li>All your pads and sticks</li>
                <li>All your tags and settings</li>
              </ul>
              <p className="font-semibold text-red-600 mt-3">This action cannot be undone!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Yes, Delete My Account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
