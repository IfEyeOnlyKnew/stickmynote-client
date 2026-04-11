"use client"

import { useState, useEffect, useCallback } from "react"
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  getDay,
} from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Clock,
  AlertCircle,
  Plus,
  DollarSign,
  Send,
  CheckCircle2,
  XCircle,
  Lightbulb,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserMenu } from "@/components/user-menu"
import { formatDuration } from "@/lib/utils"
import { ManualTimeEntryDialog } from "@/components/calsticks/ManualTimeEntryDialog"
import { toast } from "@/hooks/use-toast"

interface TimeEntry {
  id: string
  task_id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  note: string | null
  is_billable: boolean
  approval_status: string
  rejection_note: string | null
  task?: { id: string; content: string; stick: { id: string; topic: string } | null } | null
}

interface Suggestion {
  taskId: string
  content: string
  status: string
  project: string | null
}

interface StaleTimer {
  entryId: string
  taskId: string
  startedAt: string
}

const APPROVAL_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
}

export default function TimesheetsPage() {
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tableNotFound, setTableNotFound] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [staleTimers, setStaleTimers] = useState<StaleTimer[]>([])

  const getDateRange = useCallback(() => {
    if (viewMode === "weekly") {
      return { start: startOfWeek(currentDate, { weekStartsOn: 0 }), end: endOfWeek(currentDate, { weekStartsOn: 0 }) }
    }
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }
  }, [currentDate, viewMode])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const res = await fetch(`/api/time-entries?start=${start.toISOString()}&end=${end.toISOString()}`)
      const data = await res.json()
      if (data.tableNotFound) {
        setTableNotFound(true)
        setEntries([])
      } else {
        setTableNotFound(false)
        setEntries(data.entries || [])
      }
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [getDateRange])

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/time-entries/suggestions")
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
        setStaleTimers(data.staleTimers || [])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => { fetchSuggestions() }, [fetchSuggestions])

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((d) => {
      if (viewMode === "weekly") return dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)
      return dir === 1 ? addMonths(d, 1) : subMonths(d, 1)
    })
  }

  const totalSeconds = entries.reduce((s, e) => s + (e.duration_seconds || 0), 0)
  const billableSeconds = entries.filter((e) => e.is_billable !== false).reduce((s, e) => s + (e.duration_seconds || 0), 0)
  const { start, end } = getDateRange()
  const days = eachDayOfInterval({ start, end })

  const entriesByDay = days.map((day) => ({
    day,
    entries: entries.filter((e) => isSameDay(new Date(e.started_at), day)),
    total: entries.filter((e) => isSameDay(new Date(e.started_at), day)).reduce((s, e) => s + (e.duration_seconds || 0), 0),
  }))

  const handleExport = () => {
    const url = `/api/time-entries/export?start=${start.toISOString()}&end=${end.toISOString()}`
    window.open(url, "_blank")
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllDraft = () => {
    const draftIds = entries.filter((e) => e.approval_status === "draft").map((e) => e.id)
    setSelectedIds(new Set(draftIds))
  }

  const handleApprovalAction = async (action: "submit" | "approve" | "reject") => {
    if (selectedIds.size === 0) return
    const note = action === "reject" ? prompt("Rejection reason:") : undefined
    if (action === "reject" && !note) return

    try {
      const res = await fetch("/api/time-entries/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, entryIds: [...selectedIds], note }),
      })
      const data = await res.json()
      const actionLabels: Record<string, string> = { submit: "submitted", approve: "approved" }
      const actionLabel = actionLabels[action] ?? "rejected"
      toast({ title: `${data.updated || 0} entries ${actionLabel}` })
      setSelectedIds(new Set())
      fetchEntries()
    } catch {
      toast({ title: "Error", description: "Action failed", variant: "destructive" })
    }
  }

  const maxDayTotal = Math.max(...entriesByDay.map((d) => d.total), 1)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Timesheets</h1>
            <p className="text-sm text-muted-foreground">Track time across all your projects</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "weekly" | "monthly")}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => setShowManualEntry(true)} disabled={tableNotFound}>
            <Plus className="h-4 w-4 mr-2" />
            Add Time
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={tableNotFound}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <UserMenu />
        </div>
      </div>

      {tableNotFound && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Time tracking requires database migration. Please run{" "}
            <code className="bg-muted px-1 py-0.5 rounded">scripts/windows-server/43-time-tracking-enhancements.sql</code>
          </AlertDescription>
        </Alert>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <strong>Did you work on these today?</strong>{" "}
            {suggestions.map((s) => (
              <Badge key={s.taskId} variant="outline" className="ml-1 cursor-pointer hover:bg-primary/10" onClick={() => setShowManualEntry(true)}>
                {s.content?.slice(0, 30)}
              </Badge>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {staleTimers.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {staleTimers.length} timer{staleTimers.length > 1 ? "s" : ""} running over 8 hours. You may have forgotten to stop {staleTimers.length > 1 ? "them" : "it"}.
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation + Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-medium min-w-[180px] text-center">
            {viewMode === "weekly"
              ? `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
              : format(currentDate, "MMMM yyyy")}
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span><strong>{formatDuration(totalSeconds)}</strong> total</span>
          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /><strong>{formatDuration(billableSeconds)}</strong> billable</span>
        </div>
      </div>

      {/* Monthly Calendar Heatmap */}
      {viewMode === "monthly" && !loading && (
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
          {/* Empty cells for offset */}
          {Array.from({ length: getDay(start) }, (_, n) => n).map((n) => (
            // eslint-disable-next-line react/no-array-index-key -- static empty-cell offsets in a month calendar grid
            <div key={`offset-${n}`} />
          ))}
          {entriesByDay.map(({ day, total }) => {
            const intensity = total > 0 ? Math.max(0.15, total / maxDayTotal) : 0
            const cellStyle = intensity > 0
              ? { backgroundColor: `hsl(var(--primary) / ${intensity})`, color: intensity > 0.5 ? "white" : undefined }
              : undefined
            return (
              <TooltipProvider key={day.toISOString()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="aspect-square rounded-md border flex items-center justify-center text-xs cursor-default transition-colors"
                      style={cellStyle}
                    >
                      {format(day, "d")}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{format(day, "EEEE, MMM d")}</p>
                    <p className="font-medium">{total > 0 ? formatDuration(total) : "No time logged"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>
      )}

      {/* Selection Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleApprovalAction("submit")}>
            <Send className="h-3.5 w-3.5 mr-1" /> Submit
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleApprovalAction("approve")}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleApprovalAction("reject")}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          <Button size="sm" variant="ghost" onClick={selectAllDraft}>Select All Draft</Button>
        </div>
      )}

      {/* Entries List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4"><div className="h-12 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {entriesByDay.filter((d) => d.entries.length > 0).map(({ day, entries: dayEntries, total }) => (
            <Card key={day.toISOString()}>
              <CardHeader className="pb-2 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{format(day, "EEEE, MMM d")}</CardTitle>
                  <span className="text-sm text-muted-foreground">{formatDuration(total)}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {dayEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 py-1.5 border-t first:border-t-0">
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={() => toggleSelect(entry.id)}
                    />
                    {entry.is_billable !== false && <DollarSign className="h-3 w-3 text-green-600 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate">{entry.note || entry.task_id || "Untitled"}</span>
                    </div>
                    <Badge className={APPROVAL_COLORS[entry.approval_status] || APPROVAL_COLORS.draft} variant="outline">
                      {entry.approval_status}
                    </Badge>
                    {entry.rejection_note && (
                      <span className="text-xs text-red-600 truncate max-w-[150px]">{entry.rejection_note}</span>
                    )}
                    <span className="text-sm font-medium tabular-nums">
                      {entry.duration_seconds ? formatDuration(entry.duration_seconds) : "running..."}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {entries.length === 0 && !tableNotFound && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No time entries for this period
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ManualTimeEntryDialog
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
        onSaved={() => { setShowManualEntry(false); fetchEntries() }}
      />
    </div>
  )
}
