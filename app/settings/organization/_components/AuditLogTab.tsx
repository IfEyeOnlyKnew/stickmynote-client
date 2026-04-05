"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Loader2,
  ScrollText,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Save,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AuditLogTabProps {
  currentOrgId: string
}

interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_email: string | null
  user_name: string | null
}

const ACTION_LABELS: Record<string, string> = {
  "user.login": "User Login",
  "user.login_failed": "Login Failed",
  "user.logout": "User Logout",
  "user.password_changed": "Password Changed",
  "user.2fa_enabled": "2FA Enabled",
  "user.2fa_disabled": "2FA Disabled",
  "sso.login": "SSO Login",
  "sso.login_failed": "SSO Login Failed",
  "sso.provider_created": "SSO Provider Created",
  "sso.provider_updated": "SSO Provider Updated",
  "sso.provider_deleted": "SSO Provider Deleted",
  "sso.activated": "SSO Activated",
  "sso.deactivated": "SSO Deactivated",
  "org.settings_updated": "Settings Updated",
  "org.sso_enabled": "SSO Enabled",
  "org.sso_disabled": "SSO Disabled",
  "org.member_added": "Member Added",
  "org.member_removed": "Member Removed",
  "org.member_role_changed": "Role Changed",
  "org.invite_sent": "Invite Sent",
  "org.invite_accepted": "Invite Accepted",
  "admin.lockout_cleared": "Lockout Cleared",
  "admin.user_searched": "User Searched",
}

const ACTION_COLORS: Record<string, string> = {
  "user.login": "bg-green-100 text-green-800 border-green-300",
  "user.login_failed": "bg-red-100 text-red-800 border-red-300",
  "user.logout": "bg-gray-100 text-gray-800 border-gray-300",
  "sso.login": "bg-green-100 text-green-800 border-green-300",
  "sso.login_failed": "bg-red-100 text-red-800 border-red-300",
  "sso.provider_created": "bg-blue-100 text-blue-800 border-blue-300",
  "sso.activated": "bg-blue-100 text-blue-800 border-blue-300",
  "sso.deactivated": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "org.member_added": "bg-blue-100 text-blue-800 border-blue-300",
  "org.member_removed": "bg-red-100 text-red-800 border-red-300",
  "admin.lockout_cleared": "bg-yellow-100 text-yellow-800 border-yellow-300",
}

const RESOURCE_TYPES = [
  { value: "", label: "All Resources" },
  { value: "user", label: "User" },
  { value: "session", label: "Session" },
  { value: "organization", label: "Organization" },
  { value: "identity_provider", label: "Identity Provider" },
  { value: "member", label: "Member" },
]

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "user.login", label: "User Login" },
  { value: "user.login_failed", label: "Login Failed" },
  { value: "user.logout", label: "User Logout" },
  { value: "sso.login", label: "SSO Login" },
  { value: "sso.login_failed", label: "SSO Login Failed" },
  { value: "sso.provider_created", label: "SSO Provider Created" },
  { value: "sso.activated", label: "SSO Activated" },
  { value: "sso.deactivated", label: "SSO Deactivated" },
  { value: "org.settings_updated", label: "Settings Updated" },
  { value: "org.member_added", label: "Member Added" },
  { value: "org.member_removed", label: "Member Removed" },
  { value: "org.member_role_changed", label: "Role Changed" },
  { value: "admin.lockout_cleared", label: "Lockout Cleared" },
]

export function AuditLogTab({ currentOrgId }: Readonly<AuditLogTabProps>) {
  const { toast } = useToast()

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Retention
  const [retentionDays, setRetentionDays] = useState(90)
  const [savedRetentionDays, setSavedRetentionDays] = useState(90)
  const [savingRetention, setSavingRetention] = useState(false)

  // Filters
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [resourceTypeFilter, setResourceTypeFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const pageSize = 25

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      })

      if (fromDate) params.set("from", new Date(fromDate).toISOString())
      if (toDate) params.set("to", new Date(toDate + "T23:59:59").toISOString())
      if (actionFilter) params.set("action", actionFilter)
      if (resourceTypeFilter) params.set("resourceType", resourceTypeFilter)
      if (searchQuery) params.set("search", searchQuery)

      const res = await fetch(`/api/organizations/${currentOrgId}/audit-logs?${params}`)
      if (!res.ok) throw new Error("Failed to load audit logs")

      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (error) {
      console.error("Failed to fetch audit logs:", error)
      toast({ title: "Error", description: "Failed to load audit logs", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [currentOrgId, page, fromDate, toDate, actionFilter, resourceTypeFilter, searchQuery, toast])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Fetch retention setting on mount
  useEffect(() => {
    async function fetchRetention() {
      try {
        const res = await fetch(`/api/organizations/${currentOrgId}/audit-logs/retention`)
        if (res.ok) {
          const data = await res.json()
          setRetentionDays(data.retentionDays)
          setSavedRetentionDays(data.retentionDays)
        }
      } catch {
        // Use default
      }
    }
    fetchRetention()
  }, [currentOrgId])

  const handleSaveRetention = async () => {
    setSavingRetention(true)
    try {
      const res = await fetch(`/api/organizations/${currentOrgId}/audit-logs/retention`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays }),
      })
      if (res.ok) {
        setSavedRetentionDays(retentionDays)
        toast({ title: "Retention updated", description: `Audit logs will be kept for ${retentionDays} days` })
      } else {
        toast({ title: "Error", description: "Failed to update retention setting", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update retention setting", variant: "destructive" })
    } finally {
      setSavingRetention(false)
    }
  }

  const handleClearFilters = () => {
    setFromDate("")
    setToDate("")
    setActionFilter("")
    setResourceTypeFilter("")
    setSearchQuery("")
    setPage(1)
  }

  const hasActiveFilters = fromDate || toDate || actionFilter || resourceTypeFilter || searchQuery

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true)
    try {
      const body: Record<string, string> = { format }
      if (fromDate) body.from = new Date(fromDate).toISOString()
      if (toDate) body.to = new Date(toDate + "T23:59:59").toISOString()
      if (actionFilter) body.action = actionFilter
      if (resourceTypeFilter) body.resourceType = resourceTypeFilter

      const res = await fetch(`/api/organizations/${currentOrgId}/audit-logs/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const url = globalThis.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      globalThis.URL.revokeObjectURL(url)

      toast({ title: "Export complete", description: `Audit logs exported as ${format.toUpperCase()}` })
    } catch (error) {
      console.error("Export failed:", error)
      toast({ title: "Error", description: "Failed to export audit logs", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getActionBadge = (action: string) => {
    const colorClass = ACTION_COLORS[action] || "bg-gray-100 text-gray-800 border-gray-300"
    const label = ACTION_LABELS[action] || action
    return (
      <Badge variant="outline" className={colorClass}>
        {label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ScrollText className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>View and export security and administrative events</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={exporting || total === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={exporting || total === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Filters */}
        <CardContent className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1) }}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Select value={actionFilter || "__all"} onValueChange={(v) => { setActionFilter(v === "__all" ? "" : v); setPage(1) }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Resource Type</Label>
              <Select value={resourceTypeFilter || "__all"} onValueChange={(v) => { setResourceTypeFilter(v === "__all" ? "" : v); setPage(1) }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((opt) => (
                    <SelectItem key={opt.value || "__all"} value={opt.value || "__all"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search user, action..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
              <span className="text-xs text-muted-foreground">
                {total} result{total === 1 ? "" : "s"} found
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading audit logs...</span>
            </div>
          )}
          {!loading && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No audit log entries found</p>
              {hasActiveFilters && (
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
              )}
            </div>
          )}
          {!loading && logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Timestamp</th>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Action</th>
                    <th className="text-left p-3 font-medium">Resource</th>
                    <th className="text-left p-3 font-medium">IP Address</th>
                    <th className="text-left p-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                      >
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {formatTimestamp(log.created_at)}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{log.user_name || "System"}</span>
                            {log.user_email && (
                              <span className="text-xs text-muted-foreground">{log.user_email}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">{getActionBadge(log.action)}</td>
                        <td className="p-3">
                          <span className="text-muted-foreground">{log.resource_type}</span>
                          {log.resource_id && (
                            <span className="text-xs text-muted-foreground ml-1 font-mono">
                              {log.resource_id.length > 12
                                ? `${log.resource_id.slice(0, 8)}...`
                                : log.resource_id}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-xs">
                          {log.ip_address || "—"}
                        </td>
                        <td className="p-3">
                          {expandedRow === log.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                      </tr>
                      {expandedRow === log.id && (
                        <tr key={`${log.id}-details`} className="border-b bg-muted/20">
                          <td colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Full Timestamp</Label>
                                <p className="font-mono text-xs mt-1">{log.created_at}</p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">User Agent</Label>
                                <p className="font-mono text-xs mt-1 break-all">{log.user_agent || "—"}</p>
                              </div>
                              {log.resource_id && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Resource ID</Label>
                                  <p className="font-mono text-xs mt-1 break-all">{log.resource_id}</p>
                                </div>
                              )}
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="md:col-span-2">
                                  <Label className="text-xs font-medium text-muted-foreground">Metadata</Label>
                                  <pre className="font-mono text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.old_values && Object.keys(log.old_values).length > 0 && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">Previous Values</Label>
                                  <pre className="font-mono text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.new_values && Object.keys(log.new_values).length > 0 && (
                                <div>
                                  <Label className="text-xs font-medium text-muted-foreground">New Values</Label>
                                  <pre className="font-mono text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                                    {JSON.stringify(log.new_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retention Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Log Retention</CardTitle>
              <CardDescription>
                Choose how long audit logs are kept before automatic cleanup
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="w-48">
              <Label className="text-xs text-muted-foreground">Retention Period</Label>
              <Select
                value={retentionDays.toString()}
                onValueChange={(v) => setRetentionDays(Number.parseInt(v, 10))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={handleSaveRetention}
              disabled={savingRetention || retentionDays === savedRetentionDays}
            >
              {savingRetention ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Logs older than {savedRetentionDays} days are automatically deleted by the cleanup job.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
