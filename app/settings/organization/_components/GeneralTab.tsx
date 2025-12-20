"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, Copy } from "lucide-react"
import { DomainManager } from "@/components/organization/domain-manager"

interface GeneralTabProps {
  currentOrg: {
    id: string
    name: string
    type: string
    settings?: any
  }
  orgName: string
  setOrgName: (name: string) => void
  copied: boolean
  copyOrgId: () => void
  canManageSettings: boolean
  isPersonalOrg: boolean
  saving: boolean
  handleSaveName: () => void
  getRoleBadgeColor: (role: string) => string
}

export function GeneralTab({
  currentOrg,
  orgName,
  setOrgName,
  copied,
  copyOrgId,
  canManageSettings,
  isPersonalOrg,
  saving,
  handleSaveName,
  getRoleBadgeColor,
}: Readonly<GeneralTabProps>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            {isPersonalOrg
              ? "This is your personal organization. It cannot be deleted."
              : "Manage your organization settings and information."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!canManageSettings || isPersonalOrg}
              placeholder="My Organization"
            />
          </div>

          <div className="space-y-2">
            <Label>Organization ID</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded-md text-sm font-mono">{currentOrg.id}</code>
              <Button variant="outline" size="sm" onClick={copyOrgId}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Organization Type</Label>
            <div className="flex items-center gap-2">
              <Badge className={getRoleBadgeColor(currentOrg.type)}>{currentOrg.type}</Badge>
            </div>
          </div>

          {canManageSettings && !isPersonalOrg && (
            <Button onClick={handleSaveName} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      {!isPersonalOrg && (
        <div className="mt-6">
          <DomainManager orgId={currentOrg.id} canManage={canManageSettings} />
        </div>
      )}
    </>
  )
}
