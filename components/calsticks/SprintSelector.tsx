"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Loader2, Target } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Sprint } from "@/types/sprint"
import { format, addDays } from "date-fns"

interface SprintSelectorProps {
  readonly selectedSprintId: string | null
  readonly onSprintChange: (sprintId: string | null) => void
  readonly showAllOption?: boolean
  readonly showBacklogOption?: boolean
  readonly showCreateButton?: boolean
  readonly className?: string
}

// Helper to convert select value to sprint ID
function getSprintIdFromValue(value: string): string | null {
  if (value === "all") return null
  if (value === "backlog") return "backlog"
  return value
}

export function SprintSelector({
  selectedSprintId,
  onSprintChange,
  showAllOption = true,
  showBacklogOption = true,
  showCreateButton = true,
  className,
}: SprintSelectorProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  // Form state for new sprint
  const [newSprint, setNewSprint] = useState({
    name: "",
    goal: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    velocity_planned: 0,
  })

  useEffect(() => {
    fetchSprints()
  }, [])

  const fetchSprints = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/calsticks/sprints?includeStats=true")
      if (response.ok) {
        const data = await response.json()
        setSprints(data.sprints || [])
      }
    } catch (error) {
      console.error("Failed to fetch sprints:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSprint = async () => {
    if (!newSprint.name.trim()) {
      toast({
        title: "Error",
        description: "Sprint name is required",
        variant: "destructive",
      })
      return
    }

    try {
      setCreating(true)
      const response = await fetch("/api/calsticks/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSprint),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create sprint")
      }

      const data = await response.json()
      setSprints((prev) => [data.sprint, ...prev])
      setCreateOpen(false)
      onSprintChange(data.sprint.id)
      setNewSprint({
        name: "",
        goal: "",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(addDays(new Date(), 14), "yyyy-MM-dd"),
        velocity_planned: 0,
      })
      toast({
        title: "Sprint created",
        description: `Sprint "${data.sprint.name}" has been created`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create sprint",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      planning: "secondary",
      active: "default",
      completed: "outline",
      cancelled: "destructive",
    }
    return (
      <Badge variant={variants[status] || "secondary"} className="ml-2 text-xs">
        {status}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading sprints...</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select
        value={selectedSprintId || "all"}
        onValueChange={(value) => onSprintChange(getSprintIdFromValue(value))}
      >
        <SelectTrigger className="w-[200px]">
          <Target className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Select sprint" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all">All Tasks</SelectItem>
          )}
          {showBacklogOption && (
            <SelectItem value="backlog">
              <span className="flex items-center">
                Backlog
                <Badge variant="outline" className="ml-2 text-xs">
                  No Sprint
                </Badge>
              </span>
            </SelectItem>
          )}
          {sprints.map((sprint) => (
            <SelectItem key={sprint.id} value={sprint.id}>
              <span className="flex items-center">
                {sprint.name}
                {getStatusBadge(sprint.status)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCreateButton && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Sprint</DialogTitle>
              <DialogDescription>
                Create a new sprint to organize your tasks into time-boxed iterations.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="sprint-name">Sprint Name *</Label>
                <Input
                  id="sprint-name"
                  placeholder="e.g., Sprint 1, Q1 Week 1"
                  value={newSprint.name}
                  onChange={(e) => setNewSprint((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sprint-goal">Sprint Goal</Label>
                <Textarea
                  id="sprint-goal"
                  placeholder="What do you want to accomplish in this sprint?"
                  value={newSprint.goal}
                  onChange={(e) => setNewSprint((prev) => ({ ...prev, goal: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newSprint.start_date}
                    onChange={(e) => setNewSprint((prev) => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end-date">End Date *</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newSprint.end_date}
                    onChange={(e) => setNewSprint((prev) => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="velocity">Planned Velocity (Story Points)</Label>
                <Input
                  id="velocity"
                  type="number"
                  min={0}
                  placeholder="e.g., 21"
                  value={newSprint.velocity_planned || ""}
                  onChange={(e) =>
                    setNewSprint((prev) => ({ ...prev, velocity_planned: Number.parseInt(e.target.value) || 0 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Based on your team&apos;s average velocity from past sprints
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSprint} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Sprint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
