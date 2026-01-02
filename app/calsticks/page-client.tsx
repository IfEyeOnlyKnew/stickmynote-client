"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
  Search,
  LayoutGrid,
  ListIcon,
  CalendarIcon,
  GanttChartIcon,
  Filter,
  Target,
  DollarSign,
  Clock,
  FileText,
  Zap,
  Sparkles,
  Map,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import dynamic from "next/dynamic"
import type { CalStick, Dependency } from "@/types/calstick"
import { useUser } from "@/contexts/user-context"
import { SmartCaptureDialog } from "@/components/calsticks/SmartCaptureDialog"
import { AutoScheduleDialog } from "@/components/calsticks/AutoScheduleDialog"
import { KanbanView } from "@/components/calsticks/KanbanView"
import { CalendarView } from "@/components/calsticks/CalendarView"
import { ListView } from "@/components/calsticks/ListView"
// TaskDetailModal uses Tiptap which requires client-side only rendering
const TaskDetailModal = dynamic(
  () => import("@/components/calsticks/TaskDetailModal").then((mod) => mod.TaskDetailModal),
  { ssr: false }
)
import { AutomationRulesModal } from "@/components/calsticks/AutomationRulesModal"
import { IntegrationsModal } from "@/components/calsticks/IntegrationsModal"
import { ExportDialog } from "@/components/calsticks/ExportDialog"
import Link from "next/link"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { AgendaView } from "@/components/calsticks/AgendaView"
import { CustomFieldsDialog } from "@/components/calsticks/CustomFieldsDialog"
import { TaskSettings } from "@/components/calsticks/TaskSettings"

const GanttChart = dynamic(() => import("@/components/calsticks/GanttChart"), { ssr: false })
const StoryMapView = dynamic(() => import("@/components/calsticks/StoryMap"), { ssr: false })

type ViewMode = "list" | "kanban" | "calendar" | "gantt" | "agenda" | "storymap"
type FilterType = "all" | "completed" | "not-completed" | "promoted"

interface Pad {
  id: string
  name: string
}

export default function CalSticksPageClient() {
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [calsticks, setCalsticks] = useState<CalStick[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState<Date | undefined>(undefined)
  const [ganttStickId, setGanttStickId] = useState<string | null>(null)
  const [ganttCalSticks, setGanttCalSticks] = useState<CalStick[]>([])
  const [selectedTask, setSelectedTask] = useState<CalStick | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [showCustomFieldsSettings, setShowCustomFieldsSettings] = useState(false)
  const [showAutomationModal, setShowAutomationModal] = useState(false)
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  const [selectedPad, setSelectedPad] = useState<string>("all")
  const [pads, setPads] = useState<Pad[]>([])

  const [viewMode, setViewMode] = useState<ViewMode>("kanban")

  const [showSmartCapture, setShowSmartCapture] = useState(false)
  const [showAutoSchedule, setShowAutoSchedule] = useState(false)

  const [autoArchiveDays, setAutoArchiveDays] = useState(14)

  const isMobile = useIsMobile()

  const fetchDependencies = useCallback(async (taskIds: string[]) => {
    try {
      const response = await fetch("/api/calsticks/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      })

      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        console.error("[v0] Dependencies API returned non-JSON response:", contentType)
        setDependencies([])
        return
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[v0] Error fetching dependencies: HTTP", response.status, errorData)
        setDependencies([])
        return
      }

      const data = await response.json()
      setDependencies(data.dependencies || [])
    } catch (error) {
      console.error("[v0] Error fetching dependencies:", error)
      setDependencies([])
    }
  }, [])

  const fetchCalSticks = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        filter,
        search: searchQuery,
        limit: "50",
        padId: selectedPad,
      })

      const response = await fetch(`/api/calsticks?${params}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
      if (!response.ok) throw new Error("Failed to fetch CalSticks")

      const data = await response.json()
      setCalsticks(data.calsticks)

      if (data.calsticks && data.calsticks.length > 0) {
        await fetchDependencies(data.calsticks.map((cs: CalStick) => cs.id))
      }
    } catch (error) {
      console.error("Error fetching CalSticks:", error)
      toast({
        title: "Error",
        description: "Failed to load CalSticks",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [filter, searchQuery, selectedPad, fetchDependencies])

  const fetchPads = useCallback(async () => {
    try {
      const response = await fetch("/api/pads")
      if (response.ok) {
        const data = await response.json()
        setPads(data.pads || [])
      }
    } catch (error) {
      console.error("Error fetching pads:", error)
    }
  }, [])

  useEffect(() => {
    const stickIdParam = searchParams.get("stickId")
    if (stickIdParam) {
      const findAndOpenCalStick = async () => {
        const response = await fetch(`/api/calsticks?stickId=${stickIdParam}`)
        if (response.ok) {
          const data = await response.json()
          if (data.calsticks && data.calsticks.length > 0) {
            setSelectedTask(data.calsticks[0])
            setIsTaskModalOpen(true)
          }
        }
      }
      findAndOpenCalStick()
    }
  }, [searchParams])

  useEffect(() => {
    fetchPads()
  }, [fetchPads])

  useEffect(() => {
    fetchCalSticks()
  }, [fetchCalSticks])

  // Polling for realtime updates
  useEffect(() => {
    if (!user?.id) return

    const POLL_INTERVAL = 30000 // 30 seconds
    let isMounted = true

    const intervalId = setInterval(() => {
      if (isMounted) {
        fetchCalSticks().catch((error) => {
          // Ignore abort errors and fetch failures when component is unmounted
          if (isMounted && error?.name !== 'AbortError') {
            console.error("[CalSticks] Polling error:", error)
          }
        })
      }
    }, POLL_INTERVAL)

    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [user?.id, fetchCalSticks])

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/calsticks/settings")
        if (response.ok) {
          const data = await response.json()
          setAutoArchiveDays(data.autoArchiveDays)
        }
      } catch (error) {
        console.error("Failed to fetch calstick settings:", error)
      }
    }
    fetchSettings()
  }, [])

  const toggleComplete = async (calstickId: string, completed: boolean) => {
    const newCompleted = !completed
    const completedAt = newCompleted ? new Date().toISOString() : null

    try {
      const response = await fetch(`/api/sticks/replies/${calstickId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calstick_completed: newCompleted,
          calstick_completed_at: completedAt,
        }),
      })

      if (!response.ok) throw new Error("Failed to update CalStick")

      setCalsticks((prev) =>
        prev.map((cs) =>
          cs.id === calstickId
            ? {
                ...cs,
                calstick_completed: newCompleted,
                calstick_completed_at: completedAt,
              }
            : cs,
        ),
      )

      toast({
        title: "Success",
        description: `Task marked as ${newCompleted ? "complete" : "incomplete"}`,
      })
    } catch (error) {
      console.error("Error updating CalStick:", error)
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      })
    }
  }

  const updateCalStickDate = async (calstickId: string, newDate: Date | undefined) => {
    try {
      const response = await fetch(`/api/sticks/replies/${calstickId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calstick_date: newDate ? newDate.toISOString() : null,
        }),
      })

      if (!response.ok) throw new Error("Failed to update CalStick date")

      setCalsticks((prev) =>
        prev.map((cs) =>
          cs.id === calstickId
            ? {
                ...cs,
                calstick_date: newDate ? newDate.toISOString() : null,
              }
            : cs,
        ),
      )

      setEditingId(null)
      setEditDate(undefined)

      toast({
        title: "Success",
        description: "Task date updated",
      })
    } catch (error) {
      console.error("Error updating CalStick date:", error)
      toast({
        title: "Error",
        description: "Failed to update task date",
        variant: "destructive",
      })
    }
  }

  const updateCalStickStatus = async (calstickId: string, newStatus: string) => {
    const previousCalsticks = [...calsticks]
    // Optimistic update
    setCalsticks((prev) =>
      prev.map((cs) =>
        cs.id === calstickId
          ? {
              ...cs,
              calstick_status: newStatus,
              calstick_completed: newStatus === "done",
              calstick_completed_at: newStatus === "done" ? new Date().toISOString() : null,
            }
          : cs,
      ),
    )

    try {
      const response = await fetch(`/api/sticks/replies/${calstickId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calstick_status: newStatus,
          calstick_completed: newStatus === "done",
          calstick_completed_at: newStatus === "done" ? new Date().toISOString() : null,
        }),
      })

      if (!response.ok) throw new Error("Failed to update CalStick status")

      const data = await response.json()
      if (data.reply) {
        setCalsticks((prev) =>
          prev.map((cs) =>
            cs.id === calstickId
              ? {
                  ...cs,
                  ...data.reply,
                  calstick_status: newStatus,
                  calstick_completed: newStatus === "done",
                }
              : cs,
          ),
        )
      }

      toast({
        title: "Success",
        description: "Task status updated",
      })
    } catch (error) {
      console.error("Error updating CalStick status:", error)
      // Revert on error
      setCalsticks(previousCalsticks)
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      })
    }
  }

  const openGanttChart = async (stickId: string) => {
    try {
      const stickCalSticks = calsticks.filter((cs) => cs.stick_id === stickId)
      setGanttCalSticks(stickCalSticks)
      setGanttStickId(stickId)
    } catch (error) {
      console.error("Error opening Gantt chart:", error)
      toast({
        title: "Error",
        description: "Failed to open Gantt chart",
        variant: "destructive",
      })
    }
  }

  const handleStickClick = (cs: CalStick) => {
    if (editingId) return
    setSelectedTask(cs)
    setIsTaskModalOpen(true)
  }

  const handleSaveTask = async (taskId: string, updates: Partial<CalStick>) => {
    try {
      const response = await fetch(`/api/sticks/replies/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error("Failed to save task")

      setCalsticks((prev) => prev.map((cs) => (cs.id === taskId ? { ...cs, ...updates } : cs)))

      toast({
        title: "Success",
        description: "Task updated successfully",
      })

      await fetchCalSticks()
    } catch (error) {
      console.error("Error saving task:", error)
      toast({
        title: "Error",
        description: "Failed to save task",
        variant: "destructive",
      })
    }
  }

  const filteredCalSticks = calsticks.filter((cs) => {
    if (filter === "completed") {
      return cs.calstick_completed
    } else if (filter === "not-completed") {
      return !cs.calstick_completed
    } else if (filter === "promoted") {
      return cs.social_stick_id != null
    }
    return true
  })

  const handleSettingsChange = (days: number) => {
    setAutoArchiveDays(days)
  }

  const renderContent = () => {
    if (isMobile && viewMode !== "gantt" && viewMode !== "storymap") {
      return <AgendaView calsticks={calsticks} onToggleComplete={toggleComplete} onStickClick={handleStickClick} />
    }

    switch (viewMode) {
      case "kanban":
        return (
          <KanbanView
            calsticks={filteredCalSticks}
            onToggleComplete={toggleComplete}
            onUpdateStatus={updateCalStickStatus}
            onStickClick={handleStickClick}
            autoArchiveDays={autoArchiveDays}
          />
        )
      case "calendar":
        return (
          <CalendarView
            calsticks={calsticks}
            onToggleComplete={toggleComplete}
            onUpdateDate={updateCalStickDate}
            onStickClick={handleStickClick}
          />
        )
      case "gantt":
        return <GanttChart calsticks={calsticks} dependencies={dependencies} onTaskChange={handleTaskDateChange} />
      case "storymap":
        return <StoryMapView calsticks={calsticks} onTaskClick={handleStickClick} />
      case "list":
      default:
        return (
          <ListView
            calsticks={calsticks}
            onToggleComplete={toggleComplete}
            onUpdateDate={updateCalStickDate}
            onStickClick={handleStickClick}
            editingId={editingId}
            setEditingId={setEditingId}
            editDate={editDate}
            setEditDate={setEditDate}
            openGanttChart={openGanttChart}
            autoArchiveDays={autoArchiveDays}
          />
        )
    }
  }

  const handleTaskDateChange = async (taskId: string, startDate: Date, endDate: Date) => {
    try {
      const estimatedDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      const estimatedHours = estimatedDays * 8

      const response = await fetch(`/api/sticks/replies/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calstick_start_date: startDate.toISOString(),
          calstick_date: endDate.toISOString(),
          calstick_estimated_hours: estimatedHours,
        }),
      })

      if (!response.ok) throw new Error("Failed to update task dates")

      setCalsticks((prev) =>
        prev.map((cs) =>
          cs.id === taskId
            ? {
                ...cs,
                calstick_start_date: startDate.toISOString(),
                calstick_date: endDate.toISOString(),
                calstick_estimated_hours: estimatedHours,
              }
            : cs,
        ),
      )

      toast({
        title: "Success",
        description: "Task dates updated",
      })
    } catch (error) {
      console.error("Error updating task dates:", error)
      toast({
        title: "Error",
        description: "Failed to update task dates",
        variant: "destructive",
      })
    }
  }

  const handleSmartCapture = async (tasks: any[]) => {
    try {
      for (const task of tasks) {
        await fetch("/api/calsticks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: task.title,
            calstick_priority: task.priority || "medium",
            calstick_estimated_hours: task.estimatedHours || 1,
            calstick_date: task.date || null,
            calstick_start_date: task.date || null,
            calstick_labels: task.tags || [],
          }),
        })
      }

      await fetchCalSticks()
    } catch (error) {
      console.error("Error creating tasks from smart capture:", error)
      throw error
    }
  }

  const handleAutoSchedule = async (schedule: { id: string; startDate: string; endDate: string }[]) => {
    try {
      for (const item of schedule) {
        await fetch(`/api/sticks/replies/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calstick_start_date: item.startDate,
            calstick_date: item.endDate,
          }),
        })
      }

      await fetchCalSticks()
    } catch (error) {
      console.error("Error applying auto-schedule:", error)
      throw error
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BreadcrumbNav
                items={[
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "Paks-Hub", href: "/paks" },
                  { label: "CalSticks", href: "/calsticks" },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <UserMenu />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 md:min-w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedPad} onValueChange={setSelectedPad}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {pads.map((pad) => (
                    <SelectItem key={pad.id} value={pad.id}>
                      {pad.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={() => setFilter(filter === "all" ? "not-completed" : "all")}>
                <Filter className="h-4 w-4 mr-2" />
                {filter === "all" && "All"}
                {filter === "completed" && "Completed"}
                {filter !== "all" && filter !== "completed" && "Active"}
              </Button>

              <Button variant="outline" size="sm" onClick={() => setFilter(filter === "promoted" ? "all" : "promoted")}>
                <Filter className="h-4 w-4 mr-2" />
                {filter === "promoted" ? "All" : "Promoted"}
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isMobile && (
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-auto">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="kanban" className="text-xs">
                      <LayoutGrid className="h-3 w-3 md:mr-1" />
                      <span className="hidden md:inline">Board</span>
                    </TabsTrigger>
                    <TabsTrigger value="list" className="text-xs">
                      <ListIcon className="h-3 w-3 md:mr-1" />
                      <span className="hidden md:inline">List</span>
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="text-xs">
                      <CalendarIcon className="h-3 w-3 md:mr-1" />
                      <span className="hidden md:inline">Cal</span>
                    </TabsTrigger>
                    <TabsTrigger value="gantt" className="text-xs">
                      <GanttChartIcon className="h-3 w-3 md:mr-1" />
                      <span className="hidden md:inline">Gantt</span>
                    </TabsTrigger>
                    <TabsTrigger value="agenda" className="text-xs">
                      <FileText className="h-3 w-3 md:mr-1" />
                      <span className="hidden md:inline">Agenda</span>
                    </TabsTrigger>
                    <TabsTrigger value="storymap" className="text-xs">
                      <Map className="h-3 w-3 md:mr-1" />
                      <span className="hidden md:inline">Story</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              <Button variant="outline" size="sm" onClick={() => setShowSmartCapture(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">Smart Capture</span>
              </Button>

              <Button variant="outline" size="sm" onClick={() => setShowAutoSchedule(true)}>
                <Zap className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">Auto Schedule</span>
              </Button>

              <Link href="/calsticks/budget">
                <Button variant="outline" size="sm">
                  <DollarSign className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Budget</span>
                </Button>
              </Link>

              <Link href="/calsticks/portfolio">
                <Button variant="outline" size="sm">
                  <Target className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Portfolio</span>
                </Button>
              </Link>

              <Link href="/calsticks/timesheets">
                <Button variant="outline" size="sm">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Timesheets</span>
                </Button>
              </Link>

              <TaskSettings autoArchiveDays={autoArchiveDays} onSettingsChange={handleSettingsChange} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading tasks...</p>
            </div>
          </div>
        )}
        {!loading && calsticks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by creating your first task or using Smart Capture
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowSmartCapture(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Smart Capture
              </Button>
            </div>
          </div>
        )}
        {!loading && calsticks.length > 0 && renderContent()}
      </main>

      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        calsticks={calsticks}
        selectedPad={selectedPad}
      />

      <SmartCaptureDialog
        isOpen={showSmartCapture}
        onClose={() => setShowSmartCapture(false)}
        onTasksParsed={handleSmartCapture}
      />

      <AutoScheduleDialog
        isOpen={showAutoSchedule}
        onClose={() => setShowAutoSchedule(false)}
        unscheduledTasks={calsticks.filter((cs) => !cs.calstick_completed)}
        onTasksScheduled={handleAutoSchedule}
      />

      <TaskDetailModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false)
          setSelectedTask(null)
        }}
        task={selectedTask}
        onSave={handleSaveTask}
      />

      <CustomFieldsDialog open={showCustomFieldsSettings} onOpenChange={setShowCustomFieldsSettings} />

      <AutomationRulesModal isOpen={showAutomationModal} onClose={() => setShowAutomationModal(false)} />

      <IntegrationsModal isOpen={showIntegrationsModal} onClose={() => setShowIntegrationsModal(false)} />

      {ganttStickId && (
        <Dialog open={!!ganttStickId} onOpenChange={() => setGanttStickId(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Gantt Chart</DialogTitle>
            </DialogHeader>
            <div className="overflow-auto">
              <GanttChart calsticks={ganttCalSticks} dependencies={dependencies} onTaskChange={handleTaskDateChange} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
