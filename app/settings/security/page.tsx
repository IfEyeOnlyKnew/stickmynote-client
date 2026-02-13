"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, ShieldCheck, ShieldAlert, Key } from "lucide-react"
import { TwoFactorDisableDialog } from "@/components/auth/TwoFactorDisableDialog"
import { BackupCodesDialog } from "@/components/auth/BackupCodesDialog"

interface TwoFactorStatus {
  enabled: boolean
  method?: string
  verified?: boolean
  backupCodesRemaining?: number
  lastUsedAt?: string | null
}

export default function SecuritySettingsPage() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDisable, setShowDisable] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const response = await fetch("/api/auth/2fa/status")
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error("Failed to fetch 2FA status:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Security Settings</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground">
            Manage your account security and two-factor authentication
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {status?.enabled ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                )}
                <CardTitle>Two-Factor Authentication</CardTitle>
              </div>
              {status?.enabled && (
                <span className="text-sm font-medium text-green-600">Enabled</span>
              )}
            </div>
            <CardDescription>
              Add an extra layer of security to your account with two-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.enabled ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Authenticator App (TOTP)</p>
                    <p className="text-sm text-muted-foreground">
                      Using Google Authenticator, Authy, or similar app
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDisable(true)}
                  >
                    Disable
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Backup Codes</p>
                      <p className="text-sm text-muted-foreground">
                        {status.backupCodesRemaining || 0} codes remaining
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBackupCodes(true)}
                  >
                    Regenerate Codes
                  </Button>
                </div>

                {status.lastUsedAt && (
                  <p className="text-sm text-muted-foreground">
                    Last used: {new Date(status.lastUsedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Two-factor authentication is managed by your organization administrator.
                  If required by your organization, you'll be prompted to set it up when you sign in.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {showDisable && (
        <TwoFactorDisableDialog
          open={showDisable}
          onOpenChange={setShowDisable}
          onSuccess={() => {
            setShowDisable(false)
            fetchStatus()
          }}
        />
      )}

      {showBackupCodes && (
        <BackupCodesDialog
          open={showBackupCodes}
          onOpenChange={setShowBackupCodes}
          onSuccess={() => {
            setShowBackupCodes(false)
            fetchStatus()
          }}
        />
      )}
    </div>
  )
}
