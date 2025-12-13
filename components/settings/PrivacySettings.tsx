import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Eye, AtSign } from "lucide-react"
import type { UserSettings } from "@/types/settings"
import { SettingSwitch } from "./SettingSwitch"

interface PrivacySettingsProps {
  privacy: UserSettings["privacy"]
  onUpdate: (field: keyof UserSettings["privacy"], value: boolean | string) => void
}

export function PrivacySettings({ privacy, onUpdate }: PrivacySettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacy & Security
        </CardTitle>
        <CardDescription>Control your privacy and data sharing preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingSwitch
          id="show-email"
          label={
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Show Email
            </span>
          }
          description="Make your email visible to other users"
          checked={privacy.showEmail}
          onCheckedChange={(checked) => onUpdate("showEmail", checked)}
        />

        <SettingSwitch
          id="allow-tagging"
          label={
            <span className="flex items-center gap-2">
              <AtSign className="h-4 w-4" />
              Allow Tagging
            </span>
          }
          description="Allow others to tag you in notes and comments"
          checked={privacy.allowTagging}
          onCheckedChange={(checked) => onUpdate("allowTagging", checked)}
        />
      </CardContent>
    </Card>
  )
}
