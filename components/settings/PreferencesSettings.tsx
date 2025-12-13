"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings, Sun, Moon, Palette } from "lucide-react"
import type { UserSettings } from "@/types/settings"
import { SettingSwitch } from "./SettingSwitch"

interface PreferencesSettingsProps {
  preferences: UserSettings["preferences"]
  onUpdate: (field: keyof UserSettings["preferences"], value: any) => void
}

export function PreferencesSettings({ preferences, onUpdate }: PreferencesSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Preferences
        </CardTitle>
        <CardDescription>Customize your app experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={preferences.theme} onValueChange={(value) => onUpdate("theme", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={preferences.language} onValueChange={(value) => onUpdate("language", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <SettingSwitch
            id="auto-save"
            label="Auto-save"
            description="Automatically save your notes as you type"
            checked={preferences.autoSave}
            onCheckedChange={(checked) => onUpdate("autoSave", checked)}
          />

          <SettingSwitch
            id="spell-check"
            label="Spell Check"
            description="Enable spell checking in note editor"
            checked={preferences.spellCheck}
            onCheckedChange={(checked) => onUpdate("spellCheck", checked)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
