"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2, Clock, Save } from "lucide-react"
import { toast } from "sonner"
import type { WorkingHours, DayOfWeek } from "@/types/user-status"
import { DAYS_OF_WEEK, COMMON_TIMEZONES } from "@/types/user-status"

// ----------------------------------------------------------------------------
// Hook for working hours
// ----------------------------------------------------------------------------

function useWorkingHours() {
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchWorkingHours = useCallback(async () => {
    try {
      const response = await fetch("/api/user/working-hours")
      if (response.ok) {
        const data = await response.json()
        setWorkingHours(data.workingHours)
      }
    } catch (error) {
      console.error("[WorkingHours] Fetch error:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const saveWorkingHours = useCallback(async (updates: Partial<WorkingHours>): Promise<boolean> => {
    setSaving(true)
    try {
      const response = await fetch("/api/user/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setWorkingHours(data.workingHours)
        return true
      }
      return false
    } catch (error) {
      console.error("[WorkingHours] Save error:", error)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkingHours()
  }, [fetchWorkingHours])

  return { workingHours, loading, saving, saveWorkingHours, setWorkingHours }
}

// ----------------------------------------------------------------------------
// Working Hours Settings Component
// ----------------------------------------------------------------------------

interface WorkingHoursSettingsProps {
  readonly className?: string
}

export function WorkingHoursSettings({ className }: WorkingHoursSettingsProps) {
  const { workingHours, loading, saving, saveWorkingHours, setWorkingHours } = useWorkingHours()
  const [hasChanges, setHasChanges] = useState(false)

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!workingHours) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load working hours settings
        </CardContent>
      </Card>
    )
  }

  const updateField = <K extends keyof WorkingHours>(field: K, value: WorkingHours[K]) => {
    setWorkingHours({ ...workingHours, [field]: value })
    setHasChanges(true)
  }

  const updateDaySchedule = (day: DayOfWeek, type: "start" | "end", value: string | null) => {
    const field = `${day}_${type}` as keyof WorkingHours
    updateField(field, value as any)
  }

  const enableDay = (day: DayOfWeek) => {
    updateField(`${day}_start` as keyof WorkingHours, "09:00" as any)
    updateField(`${day}_end` as keyof WorkingHours, "17:00" as any)
  }

  const disableDay = (day: DayOfWeek) => {
    updateField(`${day}_start` as keyof WorkingHours, null as any)
    updateField(`${day}_end` as keyof WorkingHours, null as any)
  }

  const handleSave = async () => {
    const success = await saveWorkingHours(workingHours)
    if (success) {
      toast.success("Working hours saved")
      setHasChanges(false)
    } else {
      toast.error("Failed to save working hours")
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Working Hours
            </CardTitle>
            <CardDescription>
              Set your availability schedule. You&apos;ll appear as &quot;Away&quot; outside these hours.
            </CardDescription>
          </div>
          <Switch
            checked={workingHours.enabled}
            onCheckedChange={(checked) => updateField("enabled", checked)}
          />
        </div>
      </CardHeader>

      {workingHours.enabled && (
        <CardContent className="space-y-6">
          {/* Timezone */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={workingHours.timezone}
              onValueChange={(value) => updateField("timezone", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Day Schedule */}
          <div className="space-y-3">
            <Label>Schedule</Label>
            <div className="space-y-2">
              {DAYS_OF_WEEK.map((day) => {
                const startKey = `${day.key}_start` as keyof WorkingHours
                const endKey = `${day.key}_end` as keyof WorkingHours
                const startValue = workingHours[startKey] as string | null
                const endValue = workingHours[endKey] as string | null
                const isEnabled = startValue !== null && endValue !== null

                return (
                  <div key={day.key} className="flex items-center gap-3">
                    <div className="w-20">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => checked ? enableDay(day.key) : disableDay(day.key)}
                      />
                    </div>
                    <span className="w-12 text-sm font-medium">{day.short}</span>
                    {isEnabled ? (
                      <>
                        <Input
                          type="time"
                          value={startValue || "09:00"}
                          onChange={(e) => updateDaySchedule(day.key, "start", e.target.value)}
                          className="w-28"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={endValue || "17:00"}
                          onChange={(e) => updateDaySchedule(day.key, "end", e.target.value)}
                          className="w-28"
                        />
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not working</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Away Message */}
          <div className="space-y-2">
            <Label>Away message</Label>
            <Textarea
              value={workingHours.away_message || ""}
              onChange={(e) => updateField("away_message", e.target.value)}
              placeholder="Message shown when you're outside working hours..."
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              This message is shown to others when they try to contact you outside your working hours.
            </p>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ----------------------------------------------------------------------------
// Compact Working Hours Display
// ----------------------------------------------------------------------------
// Shows a summary of working hours for display in other contexts

interface WorkingHoursDisplayProps {
  readonly workingHours: WorkingHours
  readonly className?: string
}

export function WorkingHoursDisplay({ workingHours, className }: WorkingHoursDisplayProps) {
  if (!workingHours.enabled) {
    return null
  }

  // Get which days are enabled
  const enabledDays = DAYS_OF_WEEK.filter((day) => {
    const startKey = `${day.key}_start` as keyof WorkingHours
    return workingHours[startKey] !== null
  })

  if (enabledDays.length === 0) {
    return null
  }

  // Check if all days have the same hours
  const firstStart = workingHours.monday_start
  const firstEnd = workingHours.monday_end
  const allSameHours = enabledDays.every((day) => {
    const startKey = `${day.key}_start` as keyof WorkingHours
    const endKey = `${day.key}_end` as keyof WorkingHours
    return workingHours[startKey] === firstStart && workingHours[endKey] === firstEnd
  })

  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        {allSameHours ? (
          <span>
            {enabledDays.map((d) => d.short).join(", ")} {firstStart} - {firstEnd}
          </span>
        ) : (
          <span>Custom schedule</span>
        )}
      </div>
    </div>
  )
}
