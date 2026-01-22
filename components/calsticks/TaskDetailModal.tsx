"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CalendarIcon,
  Tag,
  Save,
  X,
  Paperclip,
  Repeat,
  Bell,
  User,
  Target,
  Hash,
} from "lucide-react"

// Dynamically import TiptapEditor with SSR disabled
const TiptapEditor = dynamic(() => import("./TiptapEditor"), {
  ssr: false,
  loading: () => <div className="border rounded-lg p-4 min-h-[200px] bg-muted/20">Loading editor...</div>,
})
import { format, parseISO } from "date-fns"
import type { CalStick } from "@/types/calstick"
import { TaskTimer } from "@/components/calsticks/TaskTimer"
import { CustomFieldsForm } from "@/components/calsticks/CustomFieldsForm"
import { ChecklistView } from "@/components/calsticks/ChecklistView"
import { SubtaskPanel } from "@/components/calsticks/SubtaskPanel"
import { TaskProgressIndicator } from "@/components/calsticks/TaskProgressIndicator"
import { AttachmentPanel } from "@/components/calsticks/AttachmentPanel"
import { RecurringTaskModal } from "./RecurringTaskModal"
import { ReminderModal } from "./ReminderModal"
import type { ChecklistData, TaskProgress } from "@/types/checklist"
import type { Sprint } from "@/types/sprint"

interface TaskDetailModalProps {
  task: CalStick | null
  isOpen: boolean
  onClose: () => void
  onSave: (taskId: string, updates: Partial<CalStick>) => Promise<void>
}

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "low", label: "Low", color: "bg-blue-500" },
  { value: "none", label: "None", color: "bg-gray-400" },
]

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "in-review", label: "In Review" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
]

export function TaskDetailModal({ task, isOpen, onClose, onSave }: TaskDetailModalProps) {
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("none")
  const [status, setStatus] = useState("todo")
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [estimatedHours, setEstimatedHours] = useState("")
  const [labels, setLabels] = useState<string[]>([])
  const [newLabel, setNewLabel] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistData>({ items: [] })
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [editorContent, setEditorContent] = useState("")
  const [sprintId, setSprintId] = useState<string | null>(null)
  const [storyPoints, setStoryPoints] = useState<string>("")
  const [sprints, setSprints] = useState<Sprint[]>([])

  useEffect(() => {
    if (!task) return

    setTitle(task.stick?.topic || "")
    setPriority(task.calstick_priority || "none")
    setStatus(task.calstick_status || "todo")
    setDueDate(task.calstick_date ? parseISO(task.calstick_date) : undefined)
    setStartDate(task.calstick_start_date ? parseISO(task.calstick_start_date) : undefined)
    setEstimatedHours(task.calstick_estimated_hours?.toString() || "")
    setLabels(task.calstick_labels || [])
    setAssigneeId(task.calstick_assignee_id || null)
    setEditorContent(task.calstick_description || "")

    if (task.id !== "new") {
      const checklistData = (task as any).calstick_checklist_items as ChecklistData | null
      setChecklist(checklistData || { items: [] })
      fetchProgress()
    } else {
      setChecklist({ items: [] })
      setTaskProgress(null)
    }

    setSprintId(task.sprint_id || null)
    setStoryPoints(task.story_points?.toString() || "")

    if (task.stick?.pad_id) {
      fetchMembers(task.stick.pad_id)
    }
    fetchSprints()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task])

  const fetchSprints = async () => {
    try {
      const response = await fetch("/api/calsticks/sprints?includeStats=false")
      if (response.ok) {
        const data = await response.json()
        setSprints(data.sprints || [])
      }
    } catch (error) {
      console.error("Error fetching sprints:", error)
    }
  }

  const fetchProgress = async () => {
    if (!task || task.id === "new") return
    try {
      const response = await fetch(`/api/calsticks/${task.id}/progress`)
      if (response.ok) {
        const data = await response.json()
        setTaskProgress(data.progress)
      }
    } catch (error) {
      console.error("Error fetching progress:", error)
    }
  }

  const fetchMembers = async (padId: string) => {
    try {
      const response = await fetch(`/api/pads/${padId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error("Error fetching members:", error)
    }
  }

  const handleSave = async () => {
    if (!task) return

    setIsSaving(true)
    try {
      if (task.id === "new") {
        // Create new task
        const response = await fetch("/api/calsticks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: title,
            calstick_priority: priority,
            calstick_status: status,
            calstick_date: dueDate?.toISOString(),
            calstick_start_date: startDate?.toISOString(),
            calstick_estimated_hours: estimatedHours ? Number.parseFloat(estimatedHours) : undefined,
            calstick_labels: labels,
            calstick_description: editorContent,
            calstick_assignee_id: assigneeId,
            sprint_id: sprintId,
            story_points: storyPoints ? parseInt(storyPoints) : null,
          }),
        })

        if (!response.ok) throw new Error("Failed to create task")

        // Refresh the calsticks list
        window.location.reload()
      } else {
        // Update existing task
        await onSave(task.id, {
          stick: { ...task.stick, topic: title },
          calstick_priority: priority,
          calstick_status: status,
          calstick_date: dueDate?.toISOString(),
          calstick_start_date: startDate?.toISOString(),
          calstick_estimated_hours: estimatedHours ? Number.parseFloat(estimatedHours) : undefined,
          calstick_labels: labels,
          calstick_description: editorContent,
          calstick_assignee_id: assigneeId,
          sprint_id: sprintId,
          story_points: storyPoints ? parseInt(storyPoints) : null,
        } as Partial<CalStick>)
      }
      onClose()
    } catch (error) {
      console.error("Failed to save task:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleChecklistUpdate = async (updatedChecklist: ChecklistData) => {
    if (!task || task.id === "new") return
    try {
      const response = await fetch(`/api/calsticks/${task.id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist_items: updatedChecklist }),
      })
      if (!response.ok) throw new Error("Failed to update checklist")
      setChecklist(updatedChecklist)
      await fetchProgress()
    } catch (error) {
      console.error("Error updating checklist:", error)
      throw error
    }
  }

  const handleSubtaskRefresh = () => {
    fetchProgress()
    setRefreshKey((prev) => prev + 1)
  }

  const addLabel = () => {
    if (newLabel && !labels.includes(newLabel)) {
      setLabels([...labels, newLabel])
      setNewLabel("")
    }
  }

  const removeLabel = (label: string) => {
    setLabels(labels.filter((l) => l !== label))
  }

  if (!task) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>{task.id === "new" ? "New Task" : "Task Details"}</DialogTitle>
            <div className="flex items-center gap-2">
              {task.id !== "new" && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setShowRecurringModal(true)} title="Make Recurring">
                    <Repeat className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowReminderModal(true)} title="Set Reminder">
                    <Bell className="h-4 w-4" />
                  </Button>
                  <TaskTimer
                    taskId={task.id}
                    initialDuration={task.calstick_actual_hours ? task.calstick_actual_hours * 3600 : 0}
                  />
                </>
              )}
            </div>
          </DialogHeader>

          {taskProgress && task.id !== "new" && <TaskProgressIndicator progress={taskProgress} />}

          <Tabs defaultValue="details" className="w-full">
            <TabsList className={task.id === "new" ? "grid w-full grid-cols-2" : "grid w-full grid-cols-6"}>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
              {task.id !== "new" && (
                <>
                  <TabsTrigger value="checklist">Checklist</TabsTrigger>
                  <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
                  <TabsTrigger value="attachments">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attachments
                  </TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input id="topic" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task topic" />
              </div>

              {/* Reply content - read-only field showing the CalStick content */}
              {task.content && (
                <div className="space-y-2">
                  <Label>Reply</Label>
                  <div className="bg-muted/30 rounded-lg p-3 border text-sm whitespace-pre-wrap">
                    {task.content}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${opt.color}`} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated">Estimated Hours</Label>
                  <Input
                    id="estimated"
                    type="number"
                    step="0.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="story-points">Story Points</Label>
                  <Input
                    id="story-points"
                    type="number"
                    min={0}
                    max={100}
                    value={storyPoints}
                    onChange={(e) => setStoryPoints(e.target.value)}
                    placeholder="e.g., 1, 2, 3, 5, 8, 13"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sprint">Sprint</Label>
                <Select
                  value={sprintId || "backlog"}
                  onValueChange={(val) => setSprintId(val === "backlog" ? null : val)}
                >
                  <SelectTrigger id="sprint">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select sprint" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog (No Sprint)</SelectItem>
                    {sprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        <div className="flex items-center gap-2">
                          {sprint.name}
                          <Badge variant={sprint.status === "active" ? "default" : "secondary"} className="text-xs">
                            {sprint.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Labels</Label>
                <div className="flex gap-2">
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Add label"
                    onKeyDown={(e) => e.key === "Enter" && addLabel()}
                  />
                  <Button onClick={addLabel} size="sm">
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {labels.map((label) => (
                    <Badge
                      key={label}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeLabel(label)}
                    >
                      {label}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                <Select
                  value={assigneeId || "unassigned"}
                  onValueChange={(val) => setAssigneeId(val === "unassigned" ? null : val)}
                >
                  <SelectTrigger id="assignee">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select assignee" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name || member.username || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {task.id !== "new" && <CustomFieldsForm taskId={task.id} />}
            </TabsContent>

            <TabsContent value="description" className="space-y-4">
              <TiptapEditor
                content={editorContent}
                onChange={setEditorContent}
              />
            </TabsContent>

            {task.id !== "new" && (
              <>
                <TabsContent value="checklist" className="space-y-4">
                  <ChecklistView
                    calstickId={task.id}
                    checklist={checklist}
                    onUpdate={handleChecklistUpdate}
                    readOnly={false}
                  />
                </TabsContent>

                <TabsContent value="subtasks" className="space-y-4">
                  <SubtaskPanel
                    key={refreshKey}
                    parentCalstick={task}
                    onSubtaskClick={(subtask) => {
                      console.log("Open subtask:", subtask)
                    }}
                    onRefresh={handleSubtaskRefresh}
                  />
                </TabsContent>

                <TabsContent value="attachments" className="space-y-4">
                  <AttachmentPanel calstickId={task.id} />
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>Created: {format(parseISO(task.created_at), "PPP 'at' p")}</p>
                    {task.updated_at && <p>Updated: {format(parseISO(task.updated_at), "PPP 'at' p")}</p>}
                    {task.calstick_completed_at && (
                      <p>Completed: {format(parseISO(task.calstick_completed_at), "PPP 'at' p")}</p>
                    )}
                    <p>Created by: {task.user?.username || task.user?.email || "Unknown"}</p>
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : task.id === "new" ? "Create Task" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {task.id !== "new" && (
        <>
          <RecurringTaskModal
            taskId={task.id}
            isOpen={showRecurringModal}
            onClose={() => setShowRecurringModal(false)}
          />
          <ReminderModal taskId={task.id} isOpen={showReminderModal} onClose={() => setShowReminderModal(false)} />
        </>
      )}
    </>
  )
}
