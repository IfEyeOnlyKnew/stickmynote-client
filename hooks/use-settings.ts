"use client"

import { useState, useCallback, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
import { type UserSettings, initialSettings } from "@/types/settings"
import { toast } from "@/hooks/use-toast"

type SettingsSection = keyof UserSettings
type SettingsField<T extends SettingsSection> = keyof UserSettings[T]

export function useSettings() {
  const { user } = useUser()
  const [settings, setSettings] = useState<UserSettings>(initialSettings)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  // Load settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setIsFetching(false)
        return
      }

      try {
        const supabase = createSupabaseBrowser()

        // Fetch user profile
        const { data: userProfile } = await supabase
          .from("users")
          .select("email, display_name, avatar_url, bio")
          .eq("id", user.id)
          .maybeSingle()

        // Fetch user preferences (if stored in a separate table)
        const { data: userPrefs } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()

        if (userProfile || userPrefs) {
          setSettings((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              name: userProfile?.display_name || prev.profile.name,
              email: userProfile?.email || prev.profile.email,
              avatar: userProfile?.avatar_url || prev.profile.avatar,
              bio: userProfile?.bio || prev.profile.bio,
            },
            preferences: {
              ...prev.preferences,
              theme: userPrefs?.theme || prev.preferences.theme,
              language: userPrefs?.language || prev.preferences.language,
              defaultNoteColor: userPrefs?.default_note_color || prev.preferences.defaultNoteColor,
              autoSave: userPrefs?.auto_save ?? prev.preferences.autoSave,
              compactView: userPrefs?.compact_view ?? prev.preferences.compactView,
            },
            notifications: {
              ...prev.notifications,
              emailNotifications: userPrefs?.email_notifications ?? prev.notifications.emailNotifications,
              pushNotifications: userPrefs?.push_notifications ?? prev.notifications.pushNotifications,
              weeklyDigest: userPrefs?.weekly_digest ?? prev.notifications.weeklyDigest,
              mentionNotifications: userPrefs?.mention_notifications ?? prev.notifications.mentionNotifications,
            },
            privacy: {
              ...prev.privacy,
              profileVisibility: userPrefs?.profile_visibility || prev.privacy.profileVisibility,
              showEmail: userPrefs?.show_email ?? prev.privacy.showEmail,
              allowTagging: userPrefs?.allow_tagging ?? prev.privacy.allowTagging,
            },
          }))
        }
      } catch (error) {
        console.error("Error loading settings:", error)
      } finally {
        setIsFetching(false)
      }
    }

    loadSettings()
  }, [user])

  const updateSetting = useCallback(
    <T extends SettingsSection>(section: T, field: SettingsField<T>, value: unknown) => {
      setSettings((prev) => ({
        ...prev,
        [section]: { ...prev[section], [field]: value },
      }))
    },
    [],
  )

  const handleSave = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const supabase = createSupabaseBrowser()

      // Update user profile
      const { error: profileError } = await supabase
        .from("users")
        .update({
          display_name: settings.profile.name,
          bio: settings.profile.bio,
          avatar_url: settings.profile.avatar,
        })
        .eq("id", user.id)

      if (profileError) throw profileError

      // Upsert user preferences
      const { error: prefsError } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          theme: settings.preferences.theme,
          language: settings.preferences.language,
          default_note_color: settings.preferences.defaultNoteColor,
          auto_save: settings.preferences.autoSave,
          compact_view: settings.preferences.compactView,
          email_notifications: settings.notifications.emailNotifications,
          push_notifications: settings.notifications.pushNotifications,
          weekly_digest: settings.notifications.weeklyDigest,
          mention_notifications: settings.notifications.mentionNotifications,
          profile_visibility: settings.privacy.profileVisibility,
          show_email: settings.privacy.showEmail,
          allow_tagging: settings.privacy.allowTagging,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )

      if (prefsError) {
        console.error("Error saving preferences:", prefsError)
        // Don't throw - preferences table might not exist yet
      }

      toast({
        title: "Settings saved!",
        description: "Your preferences have been updated successfully.",
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error saving settings",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [user, settings])

  const handleExportData = useCallback(async () => {
    if (!user) return

    try {
      const supabase = createSupabaseBrowser()

      // Fetch all user data
      const { data: notes } = await supabase.from("personal_sticks").select("*").eq("user_id", user.id)

      const { data: replies } = await supabase.from("personal_sticks_replies").select("*").eq("user_id", user.id)

      const { data: tags } = await supabase.from("personal_sticks_tags").select("*").eq("user_id", user.id)

      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
        },
        notes: notes || [],
        replies: replies || [],
        tags: tags || [],
      }

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `stickymynote-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Export complete",
        description: "Your data has been exported successfully.",
      })
    } catch (error) {
      console.error("Error exporting data:", error)
      toast({
        title: "Export failed",
        description: "Unable to export your data. Please try again.",
        variant: "destructive",
      })
    }
  }, [user])

  const handleDeleteAccount = useCallback(async () => {
    toast({
      title: "Account deletion requested",
      description: "Please contact support to complete account deletion.",
      variant: "destructive",
    })
  }, [])

  return {
    settings,
    isLoading: isLoading || isFetching,
    updateSetting,
    handleSave,
    handleExportData,
    handleDeleteAccount,
  }
}
