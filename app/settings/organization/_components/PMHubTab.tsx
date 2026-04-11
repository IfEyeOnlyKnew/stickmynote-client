"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Loader2, BarChart3, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PMSettings {
  timesheets_retention_years: number
  invoices_retention_years: number
  budgets_retention_years: number
  portfolio_retention_years: number
  goals_retention_years: number
  auto_archive_paid_invoices_days: number
  auto_archive_completed_goals_days: number
  auto_purge_draft_entries_days: number
  default_billable: boolean
  default_hourly_rate_cents: number
  require_time_approval: boolean
  fiscal_year_start_month: number
}

const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 0]
const ARCHIVE_DAY_OPTIONS = [0, 30, 60, 90, 180, 365]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function yearLabel(y: number) {
  if (y === 0) return "Indefinite"
  return `${y} year${y > 1 ? "s" : ""}`
}

function dayLabel(d: number) {
  if (d === 0) return "Never"
  return `${d} days`
}

export function PMHubTab() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<PMSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch("/api/pm/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch (error) {
      console.error("[PMHubTab] Error:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch("/api/pm/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast({ title: "PM Hub settings saved" })
      } else {
        throw new Error("Save failed")
      }
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof PMSettings>(key: K, value: PMSettings[K]) {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Unable to load PM Hub settings.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Data Retention Periods
          </CardTitle>
          <CardDescription>
            Configure how long PM data is retained. Based on industry compliance norms for HR, financial, and strategic records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RetentionSelect
              label="Timesheets"
              description="Payroll, time tracking, audits (recommended: 3-7 years)"
              value={settings.timesheets_retention_years}
              onChange={(v) => update("timesheets_retention_years", v)}
            />
            <RetentionSelect
              label="Invoices"
              description="Financial reporting, tax compliance (recommended: 7 years)"
              value={settings.invoices_retention_years}
              onChange={(v) => update("invoices_retention_years", v)}
            />
            <RetentionSelect
              label="Budgets"
              description="Financial planning, audit trail (recommended: 5-7 years)"
              value={settings.budgets_retention_years}
              onChange={(v) => update("budgets_retention_years", v)}
            />
            <RetentionSelect
              label="Portfolio Records"
              description="Strategic planning, governance (recommended: 5-10 years)"
              value={settings.portfolio_retention_years}
              onChange={(v) => update("portfolio_retention_years", v)}
            />
            <RetentionSelect
              label="Goals & OKRs"
              description="Performance evaluation, strategy (recommended: 1-3 years)"
              value={settings.goals_retention_years}
              onChange={(v) => update("goals_retention_years", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-Archive */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Archive</CardTitle>
          <CardDescription>
            Automatically archive completed items after a period of inactivity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Archive paid invoices after</Label>
              <Select
                value={String(settings.auto_archive_paid_invoices_days)}
                onValueChange={(v) => update("auto_archive_paid_invoices_days", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARCHIVE_DAY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{dayLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Archive completed goals after</Label>
              <Select
                value={String(settings.auto_archive_completed_goals_days)}
                onValueChange={(v) => update("auto_archive_completed_goals_days", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARCHIVE_DAY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{dayLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auto-purge draft time entries after</Label>
              <Select
                value={String(settings.auto_purge_draft_entries_days)}
                onValueChange={(v) => update("auto_purge_draft_entries_days", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARCHIVE_DAY_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{dayLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only removes unapproved draft entries</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Time Tracking Defaults</CardTitle>
          <CardDescription>
            Default settings applied to new time entries and projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Default billable</Label>
              <p className="text-sm text-muted-foreground">New time entries are billable by default</p>
            </div>
            <Switch
              checked={settings.default_billable}
              onCheckedChange={(v) => update("default_billable", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Require time approval</Label>
              <p className="text-sm text-muted-foreground">Time entries must be submitted and approved before invoicing</p>
            </div>
            <Switch
              checked={settings.require_time_approval}
              onCheckedChange={(v) => update("require_time_approval", v)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default hourly rate</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(settings.default_hourly_rate_cents / 100).toFixed(2)}
                  onChange={(e) => update("default_hourly_rate_cents", Math.round(Number(e.target.value) * 100))}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">/ hour</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fiscal year starts</Label>
              <Select
                value={String(settings.fiscal_year_start_month)}
                onValueChange={(v) => update("fiscal_year_start_month", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    // eslint-disable-next-line react/no-array-index-key -- MONTHS is a fixed-length constant in calendar order
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save PM Hub Settings
        </Button>
      </div>
    </div>
  )
}

function RetentionSelect({
  label,
  description,
  value,
  onChange,
}: {
  readonly label: string
  readonly description: string
  readonly value: number
  readonly onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={y} value={String(y)}>{yearLabel(y)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
