"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, Shield } from "lucide-react"

interface OrgSettingsTabProps {
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
