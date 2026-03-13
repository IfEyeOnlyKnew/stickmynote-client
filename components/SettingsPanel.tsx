"use client"

import { Button } from "@/components/ui/button"
import { useSettings } from "@/hooks/use-settings"
import { ProfileSettings } from "@/components/settings/ProfileSettings"
import { PreferencesSettings } from "@/components/settings/PreferencesSettings"
import { NotificationSettings } from "@/components/settings/NotificationSettings"
import { PrivacySettings } from "@/components/settings/PrivacySettings"
import { DataManagementSettings } from "@/components/settings/DataManagementSettings"
import { AccessibilitySettings } from "@/components/settings/AccessibilitySettings"

export function SettingsPanel() {
  const { settings, isLoading, updateSetting, handleSave, handleExportData, handleDeleteAccount } = useSettings()

  return (
    <div className="space-y-6">
      <ProfileSettings profile={settings.profile} onUpdate={(field, value) => updateSetting("profile", field, value)} />

      <PreferencesSettings
        preferences={settings.preferences}
        onUpdate={(field, value) => updateSetting("preferences", field, value)}
      />

      <NotificationSettings
        notifications={settings.notifications}
        onUpdate={(field, value) => updateSetting("notifications", field, value)}
      />

      <PrivacySettings privacy={settings.privacy} onUpdate={(field, value) => updateSetting("privacy", field, value)} />

      <AccessibilitySettings />

      <DataManagementSettings onExportData={handleExportData} onDeleteAccount={handleDeleteAccount} />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}

// Default export for compatibility
export default SettingsPanel
