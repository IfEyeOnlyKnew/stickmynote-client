"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Archive,
  Trash2,
  Clock,
  Shield,
  Search,
  Settings,
  Globe,
  Lock,
  PlayCircle,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { CleanupPolicySettings } from "@/components/social/cleanup-policy-settings"
import { toast } from "sonner"

type CleanupPolicy = {
  social_pad_id: string
  auto_archive_enabled: boolean
  archive_after_days: number
  auto_delete_enabled: boolean
  delete_archived_after_days: number
  auto_close_resolved_enabled: boolean
  close_resolved_after_days: number
  max_sticks_per_pad: number | null
  exempt_pinned_sticks: boolean
  exempt_workflow_active: boolean
}

type PadWithPolicy = {
  id: string
  name: string
  description: string | null
  is_public: boolean
  owner_id: string
  created_at: string
  stick_count: number
  archived_count: number
  policy: CleanupPolicy | null
}

type CleanupStats = {
  totalPads: number
  padsWithPolicies: number
  totalArchived: number
  totalDeleted: number
  lastRunAt: string | null
}

export default function CleanupPoliciesDashboard() {
  const { user, loading } = useUser()
  const { canManage } = useOrganization()
  const router = useRouter()
  const [pads, setPads] = useState<PadWithPolicy[]>([])
  const [stats, setStats] = useState<CleanupStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isRunningCleanup, setIsRunningCleanup] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth")
    }
    if (!loading && user && !canManage) {
      router.push("/social")
    }
  }, [user, loading, router, canManage])

  const fetchData = useCallback(async () => {
    try {
      // Fetch all pads with their policies
      const padsRes = await fetch("/api/social-pads?admin=true&include_policies=true")
      const padsData = await padsRes.json()

      const padsWithPolicies: PadWithPolicy[] = []

      for (const pad of padsData.pads || []) {
        // Fetch policy for this pad
        const policyRes = await fetch(`/api/social-pads/${pad.id}/cleanup-policy`)
        const policyData = await policyRes.json()

        // Get stick counts
        const sticksRes = await fetch(`/api/social-sticks?pad_id=${pad.id}&include_archived=true`)
        const sticksData = await sticksRes.json()
        const allSticks = sticksData.sticks || []

        padsWithPolicies.push({
          ...pad,
          stick_count: allSticks.filter((s: { is_archived?: boolean }) => !s.is_archived).length,
          archived_count: allSticks.filter((s: { is_archived?: boolean }) => s.is_archived).length,
          policy: policyData.policy || null,
        })
      }

      setPads(padsWithPolicies)

      // Calculate stats
      const padsWithPoliciesCount = padsWithPolicies.filter(
        (p) =>
          p.policy &&
          (p.policy.auto_archive_enabled || p.policy.auto_delete_enabled || p.policy.auto_close_resolved_enabled),
      ).length

      setStats({
        totalPads: padsWithPolicies.length,
        padsWithPolicies: padsWithPoliciesCount,
        totalArchived: padsWithPolicies.reduce((sum, p) => sum + p.archived_count, 0),
        totalDeleted: 0, // Would need to track this separately
        lastRunAt: null, // Would need to store this
      })
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load cleanup policies data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && canManage) {
      fetchData()
    }
  }, [user, canManage, fetchData])

  const runManualCleanup = async () => {
    if (!confirm("Run cleanup now? This will apply all active policies immediately.")) return

    setIsRunningCleanup(true)
    try {
      const res = await fetch("/api/cron/cleanup-social-sticks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!res.ok) throw new Error("Cleanup failed")

      const data = await res.json()
      toast.success(`Cleanup complete: ${data.archived || 0} archived, ${data.deleted || 0} deleted`)
      fetchData()
    } catch (error) {
      console.error("Failed to run cleanup:", error)
      toast.error("Failed to run cleanup")
    } finally {
      setIsRunningCleanup(false)
    }
  }

  const toggleQuickPolicy = async (padId: string, field: string, value: boolean) => {
    try {
      const pad = pads.find((p) => p.id === padId)
      const currentPolicy = pad?.policy || {
        social_pad_id: padId,
        auto_archive_enabled: false,
        archive_after_days: 90,
        auto_delete_enabled: false,
        delete_archived_after_days: 180,
        auto_close_resolved_enabled: false,
        close_resolved_after_days: 7,
        max_sticks_per_pad: null,
        exempt_pinned_sticks: true,
        exempt_workflow_active: true,
      }

      const res = await fetch(`/api/social-pads/${padId}/cleanup-policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentPolicy, [field]: value }),
      })

      if (!res.ok) throw new Error("Failed to update")

      fetchData()
      toast.success("Policy updated")
    } catch (error) {
      console.error("Failed to update policy:", error)
      toast.error("Failed to update policy")
    }
  }

  const filteredPads = pads.filter((pad) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return pad.name.toLowerCase().includes(query) || pad.description?.toLowerCase().includes(query)
  })

  const getPolicyStatus = (policy: CleanupPolicy | null) => {
    if (!policy) return { label: "Not Configured", color: "bg-gray-100 text-gray-700" }

    const hasActive = policy.auto_archive_enabled || policy.auto_delete_enabled || policy.auto_close_resolved_enabled
    if (hasActive) return { label: "Active", color: "bg-green-100 text-green-700" }
    return { label: "Disabled", color: "bg-yellow-100 text-yellow-700" }
  }

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Social Hub", href: "/social" },
            { label: "Administration", href: "/social/admin" },
            { label: "Cleanup Policies", current: true },
          ]}
        />
        <UserMenu />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Archive className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Cleanup Policies Dashboard</h1>
        </div>
        <p className="text-muted-foreground">Manage automatic content cleanup policies across all Social Hub pads</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pads</p>
                  <p className="text-3xl font-bold">{stats.totalPads}</p>
                </div>
                <Globe className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Policies Active</p>
                  <p className="text-3xl font-bold">{stats.padsWithPolicies}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Archived</p>
                  <p className="text-3xl font-bold">{stats.totalArchived}</p>
                </div>
                <Archive className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">No Policy</p>
                  <p className="text-3xl font-bold">{stats.totalPads - stats.padsWithPolicies}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search pads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={runManualCleanup} disabled={isRunningCleanup}>
            {isRunningCleanup ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Run Cleanup Now
          </Button>
        </div>
      </div>

      {/* Pads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pad Cleanup Policies</CardTitle>
          <CardDescription>
            Configure cleanup rules for each Social Hub pad. Toggle quick settings or open full configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pad Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Sticks</TableHead>
                <TableHead className="text-center">Archived</TableHead>
                <TableHead>Policy Status</TableHead>
                <TableHead className="text-center">Auto-Archive</TableHead>
                <TableHead className="text-center">Auto-Delete</TableHead>
                <TableHead className="text-center">Auto-Close</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No pads found matching your search" : "No pads available"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPads.map((pad) => {
                  const status = getPolicyStatus(pad.policy)
                  return (
                    <TableRow key={pad.id}>
                      <TableCell className="font-medium">{pad.name}</TableCell>
                      <TableCell>
                        {pad.is_public ? (
                          <Badge variant="outline" className="gap-1">
                            <Globe className="h-3 w-3" />
                            Public
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Private
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{pad.stick_count}</TableCell>
                      <TableCell className="text-center">
                        {pad.archived_count > 0 ? (
                          <Badge variant="secondary">{pad.archived_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={pad.policy?.auto_archive_enabled || false}
                          onCheckedChange={(checked) => toggleQuickPolicy(pad.id, "auto_archive_enabled", checked)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={pad.policy?.auto_delete_enabled || false}
                          onCheckedChange={(checked) => toggleQuickPolicy(pad.id, "auto_delete_enabled", checked)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={pad.policy?.auto_close_resolved_enabled || false}
                          onCheckedChange={(checked) =>
                            toggleQuickPolicy(pad.id, "auto_close_resolved_enabled", checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4 mr-1" />
                              Configure
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Cleanup Policy Settings</DialogTitle>
                              <DialogDescription>Configure detailed cleanup rules for {pad.name}</DialogDescription>
                            </DialogHeader>
                            <CleanupPolicySettings padId={pad.id} padName={pad.name} />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Policy Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-yellow-500" />
                <h4 className="font-semibold">Auto-Archive</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Moves inactive sticks to archive after specified days. Archived sticks are hidden from the main view but
                can be restored.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                <h4 className="font-semibold">Auto-Delete</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Permanently removes archived sticks after specified days. This action is irreversible.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <h4 className="font-semibold">Auto-Close</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Archives workflow sticks marked as &quot;Resolved&quot; after specified days of inactivity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
