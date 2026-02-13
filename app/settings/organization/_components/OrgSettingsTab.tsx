"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Sparkles, Shield, ShieldCheck, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getCsrfToken } from "@/lib/client-csrf"
import { useToast } from "@/hooks/use-toast"

interface OrgSettingsTabProps {
  currentOrgId: string
  aiSessionsPerDay: number
  setAiSessionsPerDay: (value: number) => void
  savingAiSettings: boolean
  handleSaveAiSettings: () => void
  maxFailedAttempts: number
  setMaxFailedAttempts: (value: number) => void
  lockoutDurationMinutes: number
  setLockoutDurationMinutes: (value: number) => void
  savingLockoutSettings: boolean
  handleSaveLockoutSettings: () => void
}

export function OrgSettingsTab({
  currentOrgId,
  aiSessionsPerDay,
  setAiSessionsPerDay,
  savingAiSettings,
  handleSaveAiSettings,
  maxFailedAttempts,
  setMaxFailedAttempts,
  lockoutDurationMinutes,
  setLockoutDurationMinutes,
  savingLockoutSettings,
  handleSaveLockoutSettings,
}: Readonly<OrgSettingsTabProps>) {
  return (
    <>
      <AiSettingsCard
        aiSessionsPerDay={aiSessionsPerDay}
        setAiSessionsPerDay={setAiSessionsPerDay}
        savingAiSettings={savingAiSettings}
        handleSaveAiSettings={handleSaveAiSettings}
      />

      <LockoutSettingsCard
        maxFailedAttempts={maxFailedAttempts}
        setMaxFailedAttempts={setMaxFailedAttempts}
        lockoutDurationMinutes={lockoutDurationMinutes}
        setLockoutDurationMinutes={setLockoutDurationMinutes}
        savingLockoutSettings={savingLockoutSettings}
        handleSaveLockoutSettings={handleSaveLockoutSettings}
      />

      <TwoFactorPolicyCard currentOrgId={currentOrgId} />
    </>
  )
}

interface AiSettingsCardProps {
  aiSessionsPerDay: number
  setAiSessionsPerDay: (value: number) => void
  savingAiSettings: boolean
  handleSaveAiSettings: () => void
}

function AiSettingsCard({
  aiSessionsPerDay,
  setAiSessionsPerDay,
  savingAiSettings,
  handleSaveAiSettings,
}: Readonly<AiSettingsCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          AI Settings
        </CardTitle>
        <CardDescription>Configure AI-powered features for your organization</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-sessions">AI Answer Sessions Per Day</Label>
            <p className="text-sm text-muted-foreground">
              Set the maximum number of AI question sessions each user can have per day. Users can ask
              questions about their sticks using the AI assistant.
            </p>
            <div className="flex items-center gap-4">
              <Input
                id="ai-sessions"
                type="number"
                min={0}
                max={100}
                value={aiSessionsPerDay}
                onChange={(e) =>
                  setAiSessionsPerDay(Math.max(0, Math.min(100, Number.parseInt(e.target.value) || 0)))
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">sessions per user per day</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Default is 2. Set to 0 to disable AI questions for all users.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveAiSettings} disabled={savingAiSettings}>
          {savingAiSettings ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save AI Settings"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

interface LockoutSettingsCardProps {
  maxFailedAttempts: number
  setMaxFailedAttempts: (value: number) => void
  lockoutDurationMinutes: number
  setLockoutDurationMinutes: (value: number) => void
  savingLockoutSettings: boolean
  handleSaveLockoutSettings: () => void
}

function LockoutSettingsCard({
  maxFailedAttempts,
  setMaxFailedAttempts,
  lockoutDurationMinutes,
  setLockoutDurationMinutes,
  savingLockoutSettings,
  handleSaveLockoutSettings,
}: Readonly<LockoutSettingsCardProps>) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          Account Lockout Settings
        </CardTitle>
        <CardDescription>
          Configure security settings to protect against brute force login attempts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="max-attempts">Maximum Failed Login Attempts</Label>
            <p className="text-sm text-muted-foreground">
              Number of failed login attempts before an account is temporarily locked.
            </p>
            <div className="flex items-center gap-4">
              <Input
                id="max-attempts"
                type="number"
                min={1}
                max={20}
                value={maxFailedAttempts}
                onChange={(e) =>
                  setMaxFailedAttempts(Math.max(1, Math.min(20, Number.parseInt(e.target.value) || 5)))
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">attempts before lockout</span>
            </div>
            <p className="text-xs text-muted-foreground">Default is 5. Minimum 1, maximum 20.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lockout-duration">Lockout Duration</Label>
            <p className="text-sm text-muted-foreground">
              How long an account remains locked after exceeding failed attempts.
            </p>
            <div className="flex items-center gap-4">
              <Input
                id="lockout-duration"
                type="number"
                min={1}
                max={1440}
                value={lockoutDurationMinutes}
                onChange={(e) =>
                  setLockoutDurationMinutes(
                    Math.max(1, Math.min(1440, Number.parseInt(e.target.value) || 15)),
                  )
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Default is 15 minutes. Maximum 1440 minutes (24 hours).
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How Account Lockout Works</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>
              - After {maxFailedAttempts} failed login attempts, the account is locked for{" "}
              {lockoutDurationMinutes} minutes
            </li>
            <li>- Users see remaining attempts after each failed login</li>
            <li>- Successful login resets the failed attempt counter</li>
            <li>- Organization owners can manually unlock accounts from the Account tab</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveLockoutSettings} disabled={savingLockoutSettings}>
          {savingLockoutSettings ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Security Settings"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

interface TwoFactorPolicyCardProps {
  currentOrgId: string
}

function TwoFactorPolicyCard({ currentOrgId }: Readonly<TwoFactorPolicyCardProps>) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Policy settings
  const [require2FA, setRequire2FA] = useState(false)
  const [adminsOnly, setAdminsOnly] = useState(false)
  const [gracePeriodDays, setGracePeriodDays] = useState(30)

  // Compliance stats
  const [stats, setStats] = useState<{
    totalUsers: number
    usersWithout2FA: number
    usersInGracePeriod: number
    complianceRate: number
  } | null>(null)

  useEffect(() => {
    fetchPolicy()
  }, [currentOrgId])

  const fetchPolicy = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/organizations/${currentOrgId}/2fa-policy`)
      if (response.ok) {
        const data = await response.json()
        setRequire2FA(data.policy?.require_2fa || false)
        setAdminsOnly(data.policy?.enforce_for_admins_only || false)
        setGracePeriodDays(data.policy?.grace_period_days || 30)
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch 2FA policy:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePolicy = async () => {
    setSaving(true)
    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch(`/api/organizations/${currentOrgId}/2fa-policy`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          require2FA,
          adminsOnly,
          gracePeriodDays,
        }),
      })

      if (response.ok) {
        toast({
          title: "2FA Policy Updated",
          description: require2FA
            ? "Two-factor authentication is now required for your organization"
            : "Two-factor authentication enforcement has been disabled",
        })
        await fetchPolicy() // Refresh stats
      } else {
        const error = await response.json()
        toast({
          title: "Failed to update policy",
          description: error.error || "An error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to save 2FA policy:", error)
      toast({
        title: "Failed to update policy",
        description: "An error occurred while saving",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          Two-Factor Authentication Policy
        </CardTitle>
        <CardDescription>
          Require organization members to enable two-factor authentication for enhanced security
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable 2FA Enforcement */}
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="require-2fa" className="font-medium">
              Require Two-Factor Authentication
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, organization members must set up 2FA to continue accessing the application
            </p>
          </div>
          <Switch
            id="require-2fa"
            checked={require2FA}
            onCheckedChange={setRequire2FA}
          />
        </div>

        {require2FA && (
          <>
            {/* Admins Only Toggle */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="admins-only" className="font-medium">
                  Require for Admins Only
                </Label>
                <p className="text-sm text-muted-foreground">
                  Only require 2FA for organization owners and admins
                </p>
              </div>
              <Switch
                id="admins-only"
                checked={adminsOnly}
                onCheckedChange={setAdminsOnly}
              />
            </div>

            {/* Grace Period */}
            <div className="space-y-2">
              <Label htmlFor="grace-period">Grace Period (Days)</Label>
              <p className="text-sm text-muted-foreground">
                Number of days users have to enable 2FA before being blocked from accessing the application
              </p>
              <div className="flex items-center gap-4">
                <Input
                  id="grace-period"
                  type="number"
                  min={1}
                  max={90}
                  value={gracePeriodDays}
                  onChange={(e) =>
                    setGracePeriodDays(Math.max(1, Math.min(90, Number.parseInt(e.target.value) || 30)))
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Default is 30 days. Users will see warnings during the grace period.
              </p>
            </div>

            {/* Compliance Stats */}
            {stats && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4 border border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">Compliance Overview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-green-700 dark:text-green-300">Total Users:</p>
                    <p className="font-semibold text-green-900 dark:text-green-100">{stats.totalUsers}</p>
                  </div>
                  <div>
                    <p className="text-green-700 dark:text-green-300">Compliance Rate:</p>
                    <p className="font-semibold text-green-900 dark:text-green-100">
                      {stats.complianceRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-green-700 dark:text-green-300">Without 2FA:</p>
                    <p className="font-semibold text-green-900 dark:text-green-100">{stats.usersWithout2FA}</p>
                  </div>
                  <div>
                    <p className="text-green-700 dark:text-green-300">In Grace Period:</p>
                    <p className="font-semibold text-green-900 dark:text-green-100">{stats.usersInGracePeriod}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Users without 2FA will see warnings during the grace period. After the grace period expires,
                they will be unable to access the application until they enable 2FA.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSavePolicy} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save 2FA Policy"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
