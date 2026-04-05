"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Accessibility, RotateCcw } from "lucide-react"
import { useAccessibility } from "@/contexts/accessibility-context"
import { SettingSwitch } from "./SettingSwitch"

const fontSizeOptions = [
  { value: "0.85", label: "Small (85%)" },
  { value: "1", label: "Default (100%)" },
  { value: "1.15", label: "Large (115%)" },
  { value: "1.3", label: "Extra Large (130%)" },
  { value: "1.5", label: "Huge (150%)" },
]

export function AccessibilitySettings() {
  const { preferences, updatePreference, resetPreferences } = useAccessibility()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Accessibility className="h-5 w-5" />
              Accessibility
            </CardTitle>
            <CardDescription>
              Adjust display and interaction settings for your needs
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetPreferences}
            className="text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Font Size */}
        <div className="space-y-2">
          <Label htmlFor="font-size">Font Size</Label>
          <p className="text-sm text-muted-foreground">
            Adjust the text size across the entire application
          </p>
          <Select
            value={String(preferences.fontSize)}
            onValueChange={(value) => updatePreference("fontSize", Number.parseFloat(value))}
          >
            <SelectTrigger id="font-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fontSizeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Preview:{" "}
            <span style={{ fontSize: `${preferences.fontSize}rem` }}>
              The quick brown fox jumps over the lazy dog.
            </span>
          </p>
        </div>

        {/* Visual Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Visual</h3>

          <SettingSwitch
            id="high-contrast"
            label="High Contrast"
            description="Increase color contrast for better readability"
            checked={preferences.highContrast}
            onCheckedChange={(checked) => updatePreference("highContrast", checked)}
          />

          <SettingSwitch
            id="underline-links"
            label="Underline Links"
            description="Always show underlines on clickable links"
            checked={preferences.underlineLinks}
            onCheckedChange={(checked) => updatePreference("underlineLinks", checked)}
          />

          <SettingSwitch
            id="large-line-height"
            label="Increased Line Spacing"
            description="Add more space between lines of text"
            checked={preferences.largeLineHeight}
            onCheckedChange={(checked) => updatePreference("largeLineHeight", checked)}
          />
        </div>

        {/* Interaction Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Interaction</h3>

          <SettingSwitch
            id="enhanced-focus"
            label="Enhanced Focus Indicators"
            description="Show larger, more visible focus outlines when using keyboard navigation"
            checked={preferences.enhancedFocus}
            onCheckedChange={(checked) => updatePreference("enhancedFocus", checked)}
          />

          <SettingSwitch
            id="reduce-motion"
            label="Reduce Motion"
            description="Minimize animations and transitions throughout the app"
            checked={preferences.reduceMotion}
            onCheckedChange={(checked) => updatePreference("reduceMotion", checked)}
          />
        </div>

        {/* Keyboard Shortcuts Reference */}
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium">Keyboard Navigation</h3>
          <div className="text-sm text-muted-foreground space-y-1.5">
            <div className="flex justify-between">
              <span>Skip to main content</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border font-mono">Tab</kbd>
            </div>
            <div className="flex justify-between">
              <span>Navigate between elements</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border font-mono">Tab / Shift+Tab</kbd>
            </div>
            <div className="flex justify-between">
              <span>Activate buttons and links</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border font-mono">Enter / Space</kbd>
            </div>
            <div className="flex justify-between">
              <span>Close dialogs</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border font-mono">Escape</kbd>
            </div>
            <div className="flex justify-between">
              <span>Navigate menus</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border font-mono">Arrow keys</kbd>
            </div>
            <div className="flex justify-between">
              <span>Toggle sidebar</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border font-mono">Ctrl+B</kbd>
            </div>
            <div className="flex justify-between">
              <span>Command palette</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border font-mono">Ctrl+K</kbd>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
