"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
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
  KeyRound,
  Download,
  Trash2,
  AlertTriangle,
} from "lucide-react"
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
  created_at?: string | null
  updated_at?: string | null
}

export default function ProfilePage() {
  const supabase = createSupabaseBrowser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) {
        setError("You must be signed in to view your profile.")
        setProfile(null)
        setLoading(false)
        return
      }

      const { data, error: dbError } = await supabase
        .from("users")
        .select(
          "id, email, username, full_name, bio, website, phone, location, avatar_url, organize_notes, created_at, updated_at",
        )
        .eq("id", user.id)
        .maybeSingle()

      type ProfileRow = {
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
        created_at?: string | null
        updated_at?: string | null
      }

      const typedData = data as ProfileRow | null

      const meta = (user.user_metadata as Record<string, any>) || {}

      const merged: Profile = {
        id: user.id,
        email: (typedData?.email as string) ?? user.email ?? null,
        username: (typedData?.username as string) ?? (meta.username as string) ?? null,
        full_name: (typedData?.full_name as string) ?? (meta.full_name as string) ?? null,
        bio: (typedData?.bio as string) ?? null,
        website: (typedData?.website as string) ?? null,
        phone: (typedData?.phone as string) ?? (meta.phone as string) ?? null,
        location: (typedData?.location as string) ?? null,
        avatar_url: (typedData?.avatar_url as string) ?? null,
        organize_notes: (typedData?.organize_notes as boolean) ?? null,
        created_at: (typedData?.created_at as string) ?? null,
        updated_at: (typedData?.updated_at as string) ?? null,
      }

      if (dbError && (dbError.code === "42703" || /column .* does not exist/i.test(dbError.message))) {
        setError(
          "The users.phone column is missing. Please run scripts/add-users-phone-column.sql and reload this page.",
        )
      } else if (dbError && dbError.code !== "PGRST116") {
        setError(dbError.message)
      }

      setProfile(merged)
    } catch (e: any) {
      setError(e?.message || "Failed to load profile")
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload: Profile = {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        full_name: profile.full_name,
        bio: profile.bio,
        website: profile.website,
        phone: profile.phone,
        location: profile.location,
        avatar_url: profile.avatar_url,
        organize_notes: profile.organize_notes ?? false,
        updated_at: new Date().toISOString(),
        created_at: profile.created_at ?? null,
      }

      const { error: upsertError } = await supabase.from("users").upsert([payload] as any, { onConflict: "id" })

      if (upsertError) {
        const missingColumn =
          upsertError.code === "42703" || /column .* does not exist/i.test(upsertError.message || "")
        if (!missingColumn) {
          throw upsertError
        }

        const metaUpdate: Record<string, any> = {}
        if (typeof profile.phone === "string") metaUpdate.phone = profile.phone
        if (typeof profile.username === "string") metaUpdate.username = profile.username
        if (typeof profile.full_name === "string") metaUpdate.full_name = profile.full_name
        if (typeof profile.location === "string") metaUpdate.location = profile.location
        if (typeof profile.avatar_url === "string") metaUpdate.avatar_url = profile.avatar_url

        if (Object.keys(metaUpdate).length > 0) {
          const { error: metaErr } = await supabase.auth.updateUser({
            data: metaUpdate,
          })
          if (metaErr) throw metaErr
        }
      }

      setSuccess("Your profile changes have been saved.")
    } catch (e: any) {
      setError(e?.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!profile?.email) {
      setError("No email found on your profile.")
      return
    }
    setError(null)
    setSuccess(null)
    setSendingReset(true)
    try {
      const siteUrl =
        (typeof window !== "undefined" ? window.location.origin : "") ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "https://www.stickmynote.com"
      const redirectTo = `${siteUrl}/auth/reset-password/confirm`
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo,
      })
      if (resetErr) throw resetErr
      setSuccess("Password reset email sent. Please check your inbox.")
    } catch (e: any) {
      setError(e?.message || "Failed to send password reset email")
    } finally {
      setSendingReset(false)
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
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `stickmynote-data-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

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
            onClick={() => router.push("/notes")}
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
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading profile...
              </div>
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

            {!loading && profile && (
              <>
                <form onSubmit={saveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email (disabled)</Label>
                      <div className="flex gap-2">
                        <Input id="email" value={profile.email ?? ""} disabled />
                        <Button
                          type="button"
                          variant="outline"
                          className="whitespace-nowrap bg-transparent"
                          onClick={handleResetPassword}
                          disabled={sendingReset || !profile.email}
                          aria-label="Send password reset email"
                          title="Send password reset email"
                        >
                          {sendingReset ? (
                            <span className="inline-flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Reset Password
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <KeyRound className="h-4 w-4" />
                              Reset Password
                            </span>
                          )}
                        </Button>
                      </div>
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
                              <img
                                src={profile.avatar_url || "/placeholder.svg"}
                                alt="Current avatar"
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
                    <Button type="button" variant="outline" onClick={() => router.push("/notes")} disabled={saving}>
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
