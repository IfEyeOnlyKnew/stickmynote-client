"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, Eye, Send, Clock, Calendar, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DigestSettingsProps {
  preferences: {
    digest_frequency: string
    digest_time: string | null
    digest_day_of_week: number | null
    email_enabled: boolean
  }
  onUpdate: (
    updates: Partial<{
      digest_frequency: string
      digest_time: string
      digest_day_of_week: number
    }>,
  ) => Promise<void>
}

const TIMES = [
  { value: "06:00", label: "6:00 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "20:00", label: "8:00 PM" },
]

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

export function DigestSettings({ preferences, onUpdate }: DigestSettingsProps) {
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const { toast } = useToast()

  const handleFrequencyChange = async (value: string) => {
    setSaving(true)
    try {
      await onUpdate({ digest_frequency: value })
      toast({ title: "Digest frequency updated" })
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleTimeChange = async (value: string) => {
    setSaving(true)
    try {
      await onUpdate({ digest_time: value })
      toast({ title: "Digest time updated" })
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDayChange = async (value: string) => {
    setSaving(true)
    try {
      await onUpdate({ digest_day_of_week: Number.parseInt(value, 10) })
      toast({ title: "Digest day updated" })
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    window.open(`/api/digests/preview?frequency=${preferences.digest_frequency}`, "_blank")
  }

  const handleSendTest = async () => {
    setSendingTest(true)
    setTestResult(null)
    try {
      const response = await fetch("/api/digests/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency: preferences.digest_frequency }),
      })

      const data = await response.json()

      if (response.ok) {
        setTestResult({
          success: true,
          message: `Test digest sent with ${data.notificationCount} notifications`,
        })
      } else {
        setTestResult({ success: false, message: data.error || "Failed to send" })
      }
    } catch {
      setTestResult({ success: false, message: "Network error" })
    } finally {
      setSendingTest(false)
    }
  }

  const isDigestEnabled = preferences.digest_frequency !== "instant" && preferences.digest_frequency !== "none"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Email Digests</CardTitle>
        </div>
        <CardDescription>Receive condensed summaries of activity instead of individual notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Digest Frequency</Label>
          <Select
            value={preferences.digest_frequency}
            onValueChange={handleFrequencyChange}
            disabled={saving || !preferences.email_enabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Real-time
                  </Badge>
                  Instant notifications
                </div>
              </SelectItem>
              <SelectItem value="daily">
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-blue-500">Daily</Badge>
                  Daily digest
                </div>
              </SelectItem>
              <SelectItem value="weekly">
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-purple-500">Weekly</Badge>
                  Weekly digest
                </div>
              </SelectItem>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Off
                  </Badge>
                  No email notifications
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isDigestEnabled && (
          <>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Delivery Time (UTC)
              </Label>
              <Select value={preferences.digest_time || "09:00"} onValueChange={handleTimeChange} disabled={saving}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMES.map((time) => (
                    <SelectItem key={time.value} value={time.value}>
                      {time.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {preferences.digest_frequency === "weekly" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Delivery Day
                </Label>
                <Select
                  value={String(preferences.digest_day_of_week ?? 1)}
                  onValueChange={handleDayChange}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest}>
                {sendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Send Test
              </Button>
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                  testResult.success
                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                }`}
              >
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}
          </>
        )}

        {!preferences.email_enabled && (
          <p className="text-sm text-muted-foreground">Enable email notifications to use digests.</p>
        )}
      </CardContent>
    </Card>
  )
}
