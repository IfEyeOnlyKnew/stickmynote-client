import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Mail } from "lucide-react"
import type { UserSettings } from "@/types/settings"
import { SettingSwitch } from "./SettingSwitch"

interface NotificationSettingsProps {
  notifications: UserSettings["notifications"]
  onUpdate: (field: keyof UserSettings["notifications"], value: boolean) => void
}

export function NotificationSettings({ notifications, onUpdate }: NotificationSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>Choose what notifications you want to receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingSwitch
          id="email-notifications"
          label={
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Notifications
            </span>
          }
          description="Receive notifications via email"
          checked={notifications.emailNotifications}
          onCheckedChange={(checked) => onUpdate("emailNotifications", checked)}
        />

        <SettingSwitch
          id="push-notifications"
          label="Push Notifications"
          description="Receive push notifications in your browser"
          checked={notifications.pushNotifications}
          onCheckedChange={(checked) => onUpdate("pushNotifications", checked)}
        />

        <SettingSwitch
          id="weekly-digest"
          label="Weekly Digest"
          description="Receive a weekly summary of activity"
          checked={notifications.weeklyDigest}
          onCheckedChange={(checked) => onUpdate("weeklyDigest", checked)}
        />

        <SettingSwitch
          id="mention-notifications"
          label="Mention Notifications"
          description="Get notified when someone mentions you"
          checked={notifications.mentionNotifications}
          onCheckedChange={(checked) => onUpdate("mentionNotifications", checked)}
        />
      </CardContent>
    </Card>
  )
}
