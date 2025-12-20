"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useNotificationPreferences } from "@/hooks/use-notification-preferences"
import { Bell, Mail, Smartphone, Users, MessageSquare, Heart, UserPlus } from "lucide-react"
import { DigestSettings } from "./digest-settings"

interface NotificationPreferencesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationPreferencesModal({ open, onOpenChange }: NotificationPreferencesModalProps) {
  const { preferences, loading, updatePreferences } = useNotificationPreferences()
  const [saving, setSaving] = useState(false)

  const handleToggle = async (field: string, value: boolean) => {
    setSaving(true)
    try {
      await updatePreferences({ [field]: value } as Record<string, boolean>)
    } finally {
      setSaving(false)
    }
  }

  const handleDigestUpdate = async (updates: Record<string, string | number>) => {
    setSaving(true)
    try {
      await updatePreferences(updates as Record<string, unknown>)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !preferences) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="digests">Digests</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notification Channels</CardTitle>
                <CardDescription>Choose how you want to receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="in-app" className="font-medium">
                        In-App Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">Show notifications in the app</p>
                    </div>
                  </div>
                  <Switch
                    id="in-app"
                    checked={preferences.in_app_enabled}
                    onCheckedChange={(checked) => handleToggle("in_app_enabled", checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="email" className="font-medium">
                        Email Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                  </div>
                  <Switch
                    id="email"
                    checked={preferences.email_enabled}
                    onCheckedChange={(checked) => handleToggle("email_enabled", checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="push" className="font-medium">
                        Push Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">Send push notifications to your devices</p>
                    </div>
                  </div>
                  <Switch
                    id="push"
                    checked={preferences.push_enabled}
                    onCheckedChange={(checked) => handleToggle("push_enabled", checked)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="digests" className="space-y-4">
            <DigestSettings
              preferences={{
                digest_frequency: preferences.digest_frequency,
                digest_time: preferences.digest_time,
                digest_day_of_week: preferences.digest_day_of_week,
                email_enabled: preferences.email_enabled,
              }}
              onUpdate={handleDigestUpdate}
            />
          </TabsContent>

          <TabsContent value="activities" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Types</CardTitle>
                <CardDescription>Choose which activities trigger notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    <div>
                      <Label htmlFor="stick-created" className="font-medium">
                        New Sticks
                      </Label>
                      <p className="text-sm text-muted-foreground">When someone creates a new stick</p>
                    </div>
                  </div>
                  <Switch
                    id="stick-created"
                    checked={preferences.stick_created_enabled}
                    onCheckedChange={(checked) => handleToggle("stick_created_enabled", checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                    <div>
                      <Label htmlFor="stick-replied" className="font-medium">
                        Replies
                      </Label>
                      <p className="text-sm text-muted-foreground">When someone replies to a stick</p>
                    </div>
                  </div>
                  <Switch
                    id="stick-replied"
                    checked={preferences.stick_replied_enabled}
                    onCheckedChange={(checked) => handleToggle("stick_replied_enabled", checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Heart className="h-5 w-5 text-pink-600" />
                    <div>
                      <Label htmlFor="reaction" className="font-medium">
                        Reactions
                      </Label>
                      <p className="text-sm text-muted-foreground">When someone reacts to content</p>
                    </div>
                  </div>
                  <Switch
                    id="reaction"
                    checked={preferences.reaction_enabled}
                    onCheckedChange={(checked) => handleToggle("reaction_enabled", checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5 text-purple-600" />
                    <div>
                      <Label htmlFor="member-added" className="font-medium">
                        New Members
                      </Label>
                      <p className="text-sm text-muted-foreground">When someone is added to a pad</p>
                    </div>
                  </div>
                  <Switch
                    id="member-added"
                    checked={preferences.member_added_enabled}
                    onCheckedChange={(checked) => handleToggle("member_added_enabled", checked)}
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <div>
                      <Label htmlFor="pad-invite" className="font-medium">
                        Pad Invites
                      </Label>
                      <p className="text-sm text-muted-foreground">When you&apos;re invited to a pad</p>
                    </div>
                  </div>
                  <Switch
                    id="pad-invite"
                    checked={preferences.pad_invite_enabled}
                    onCheckedChange={(checked) => handleToggle("pad_invite_enabled", checked)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
