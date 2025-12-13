"use client"

import { useState, useEffect } from "react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns"
import { ChevronLeft, ChevronRight, Download, Clock, AlertCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { formatDuration } from "@/lib/utils"
import { ManualTimeEntryDialog } from "@/components/calsticks/ManualTimeEntryDialog"

export default function TimesheetsPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tableNotFound, setTableNotFound] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  useEffect(() => {
    fetchTimeEntries()
  }, [currentDate])

  const fetchTimeEntries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      })

      const response = await fetch(`/api/time-entries?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.tableNotFound) {
          setTableNotFound(true)
          setTimeEntries([])
        } else {
          setTimeEntries(data.entries)
          setTableNotFound(false)
        }
      }
    } catch (error) {
      console.error("Failed to fetch time entries:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleManualEntrySaved = () => {
    fetchTimeEntries()
    setShowManualEntry(false)
  }

  const getTotalForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    return timeEntries
      .filter((e) => format(new Date(e.started_at), "yyyy-MM-dd") === dateStr)
      .reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0)
  }

  const getTotalForWeek = () => {
    return timeEntries.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <BreadcrumbNav
            items={[
              { label: "Paks-Hub", href: "/paks" },
              { label: "CalSticks", href: "/calsticks" },
              { label: "Timesheets", current: true },
            ]}
          />
        </div>
      </div>

      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Timesheets</h1>
                <p className="text-sm text-muted-foreground">Track time across all your projects</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowManualEntry(true)} disabled={tableNotFound}>
                <Plus className="h-4 w-4 mr-2" />
                Add Time
              </Button>
              <Button variant="outline" size="sm" disabled={tableNotFound}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {tableNotFound && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Time tracking feature requires database migration. Please run{" "}
              <code className="bg-muted px-1 py-0.5 rounded">scripts/add-calstick-phase2-fields.sql</code>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-lg font-bold">Total: {formatDuration(getTotalForWeek())}</div>
        </div>

        <div className="grid grid-cols-7 gap-4 mb-6">
          {weekDays.map((day) => (
            <Card
              key={day.toString()}
              className={format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "border-primary" : ""}
            >
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{format(day, "EEE")}</CardTitle>
                <div className="text-2xl font-bold">{format(day, "d")}</div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-sm font-mono mt-2">{formatDuration(getTotalForDay(day))}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Time Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading entries...</div>
            ) : timeEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {tableNotFound ? "Database migration required" : "No time entries for this week"}
              </div>
            ) : (
              <div className="space-y-4">
                {timeEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{entry.task?.stick?.topic || "Untitled Task"}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(entry.started_at), "MMM d, h:mm a")} -
                        {entry.ended_at ? format(new Date(entry.ended_at), "h:mm a") : "Running..."}
                      </div>
                    </div>
                    <div className="font-mono font-medium">{formatDuration(entry.duration_seconds || 0)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <ManualTimeEntryDialog
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
        onSaved={handleManualEntrySaved}
      />
    </div>
  )
}
