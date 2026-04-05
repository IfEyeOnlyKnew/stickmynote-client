"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserMenu } from "@/components/user-menu"
import { toast } from "@/hooks/use-toast"
import {
  Target,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react"

interface KeyResult {
  id?: string
  title: string
  description: string
  metric_type: string
  start_value: number
  current_value: number
  target_value: number
  unit: string
}

interface Objective {
  id?: string
  title: string
  description: string
  status: string
  start_date: string
  target_date: string
  progress?: number
  parent_id?: string | null
  visibility?: string
  key_results: KeyResult[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Target }> = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
  on_track: { label: "On Track", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: TrendingUp },
  at_risk: { label: "At Risk", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", icon: AlertCircle },
  behind: { label: "Behind", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: AlertCircle },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: CheckCircle2 },
}

function computeProgress(obj: Objective): number {
  if (!obj.key_results || obj.key_results.length === 0) return 0
  const total = obj.key_results.reduce((sum, kr) => {
    const range = kr.target_value - kr.start_value
    if (range === 0) return sum + (kr.current_value >= kr.target_value ? 100 : 0)
    const pct = Math.min(100, Math.max(0, ((kr.current_value - kr.start_value) / range) * 100))
    return sum + pct
  }, 0)
  return total / obj.key_results.length
}

export default function GoalsPage() {
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"flat" | "tree">("flat")

  const fetchObjectives = useCallback(async () => {
    try {
      const res = await fetch("/api/calsticks/objectives")
      if (res.ok) {
        const data = await res.json()
        setObjectives(Array.isArray(data) ? data : data.objectives || [])
      }
    } catch (error) {
      console.error("[Goals] Error:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchObjectives()
  }, [fetchObjectives])

  const handleSave = async (obj: Objective) => {
    try {
      const method = obj.id ? "PUT" : "POST"
      const url = obj.id ? `/api/calsticks/objectives/${obj.id}` : "/api/calsticks/objectives"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      })
      if (res.ok) {
        toast({ title: `Objective ${obj.id ? "updated" : "created"}` })
        fetchObjectives()
        setShowForm(false)
        setEditingObjective(null)
      } else {
        throw new Error("Save failed")
      }
    } catch {
      toast({ title: "Error", description: "Failed to save objective", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this objective and all its key results?")) return
    try {
      const res = await fetch(`/api/calsticks/objectives/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Objective deleted" })
        fetchObjectives()
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const statusFiltered = filterStatus === "all" ? objectives : objectives.filter((o) => o.status === filterStatus)

  // Tree view: build nested structure
  const buildTree = (items: Objective[]): (Objective & { depth: number })[] => {
    const result: (Objective & { depth: number })[] = []
    const roots = items.filter((o) => !o.parent_id || !items.find((p) => p.id === o.parent_id))
    const addChildren = (parentId: string | undefined, depth: number) => {
      items.filter((o) => o.parent_id === parentId).forEach((child) => {
        result.push({ ...child, depth })
        addChildren(child.id, depth + 1)
      })
    }
    roots.forEach((root) => {
      result.push({ ...root, depth: 0 })
      addChildren(root.id, 1)
    })
    return result
  }

  const filtered = viewMode === "tree" ? buildTree(statusFiltered) : statusFiltered.map((o) => ({ ...o, depth: 0 }))

  // Summary stats
  const totalCount = objectives.length
  const onTrackCount = objectives.filter((o) => o.status === "on_track" || o.status === "completed").length
  const atRiskCount = objectives.filter((o) => o.status === "at_risk" || o.status === "behind").length
  const avgProgress = totalCount > 0
    ? objectives.reduce((sum, o) => sum + computeProgress(o), 0) / totalCount
    : 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Goals & OKRs
          </h1>
          <p className="text-muted-foreground">Set objectives and track measurable key results</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditingObjective({
                title: "",
                description: "",
                status: "not_started",
                start_date: new Date().toISOString().split("T")[0],
                target_date: "",
                parent_id: null,
                visibility: "team",
                key_results: [],
              })
              setShowForm(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Objective
          </Button>
          <UserMenu />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Objectives</div>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">On Track</div>
            <div className="text-2xl font-bold text-green-600">{onTrackCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">At Risk / Behind</div>
            <div className="text-2xl font-bold text-amber-600">{atRiskCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Avg Progress</div>
            <div className="text-2xl font-bold">{avgProgress.toFixed(0)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & View Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="on_track">On Track</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="behind">Behind</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant={viewMode === "flat" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("flat")}
            className="h-7 px-3 text-xs"
          >
            Flat
          </Button>
          <Button
            variant={viewMode === "tree" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("tree")}
            className="h-7 px-3 text-xs"
          >
            Hierarchy
          </Button>
        </div>
      </div>

      {/* Objective Form */}
      {showForm && editingObjective && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editingObjective.id ? "Edit Objective" : "New Objective"}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditingObjective(null) }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ObjectiveForm
              objective={editingObjective}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingObjective(null) }}
              allObjectives={objectives}
            />
          </CardContent>
        </Card>
      )}

      {/* Objectives List */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4"><div className="h-6 bg-muted rounded w-48" /></CardContent>
            </Card>
          ))}
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            {objectives.length === 0 ? (
              <div className="space-y-2">
                <Target className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p>No objectives yet</p>
                <p className="text-sm">Create your first objective to start tracking goals</p>
              </div>
            ) : (
              <p>No objectives match the selected filter</p>
            )}
          </CardContent>
        </Card>
      )}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((obj) => {
            const progress = computeProgress(obj)
            const statusCfg = STATUS_CONFIG[obj.status] || STATUS_CONFIG.not_started
            const StatusIcon = statusCfg.icon
            const isExpanded = expandedIds.has(obj.id!)
            const daysLeft = obj.target_date
              ? Math.ceil((new Date(obj.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null

            const parentObj = obj.parent_id ? objectives.find((o) => o.id === obj.parent_id) : null
            const depth = (obj as any).depth || 0

            return (
              <Card key={obj.id} className="overflow-hidden" style={depth > 0 ? { marginLeft: depth * 24 } : undefined}>
                <div
                  tabIndex={0}
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(obj.id!)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleExpanded(obj.id!) }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {parentObj && (
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <span className="opacity-50">↳</span> Aligned to: <span className="font-medium">{parentObj.title}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{obj.title}</h3>
                        <Badge className={statusCfg.color} variant="outline">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusCfg.label}
                        </Badge>
                        {daysLeft !== null && daysLeft > 0 && daysLeft < 14 && (
                          <span className="text-xs text-amber-600">{daysLeft}d left</span>
                        )}
                        {daysLeft !== null && daysLeft <= 0 && obj.status !== "completed" && (
                          <span className="text-xs text-red-600">Overdue</span>
                        )}
                      </div>
                      {obj.description && (
                        <p className="text-sm text-muted-foreground truncate">{obj.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1 max-w-xs">
                          <Progress value={progress} className="h-2" />
                        </div>
                        <span className="text-sm font-medium">{progress.toFixed(0)}%</span>
                        <span className="text-xs text-muted-foreground">
                          {obj.key_results?.length || 0} key result{obj.key_results?.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingObjective(obj)
                          setShowForm(true)
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(obj.id!)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Key Results */}
                {isExpanded && obj.key_results && obj.key_results.length > 0 && (
                  <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
                    {obj.key_results.map((kr, idx) => {
                      const range = kr.target_value - kr.start_value
                      let krProgress = 0
                      if (range > 0) {
                        krProgress = Math.min(100, Math.max(0, ((kr.current_value - kr.start_value) / range) * 100))
                      } else if (kr.current_value >= kr.target_value) {
                        krProgress = 100
                      }

                      return (
                        <div key={kr.id || idx} className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{kr.title || `Key Result ${idx + 1}`}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={krProgress} className="h-1.5 flex-1" />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {kr.current_value}{kr.unit ? ` ${kr.unit}` : ""} / {kr.target_value}{kr.unit ? ` ${kr.unit}` : ""}
                              </span>
                            </div>
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{krProgress.toFixed(0)}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ObjectiveForm({
  objective,
  onSave,
  onCancel,
  allObjectives,
}: {
  readonly objective: Objective
  readonly onSave: (obj: Objective) => void
  readonly onCancel: () => void
  readonly allObjectives: Objective[]
}) {
  const [formData, setFormData] = useState<Objective>(objective)

  const addKeyResult = () => {
    setFormData({
      ...formData,
      key_results: [
        ...formData.key_results,
        { title: "", description: "", metric_type: "number", start_value: 0, current_value: 0, target_value: 100, unit: "" },
      ],
    })
  }

  const updateKeyResult = (index: number, field: string, value: any) => {
    const updated = [...formData.key_results]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, key_results: updated })
  }

  const removeKeyResult = (index: number) => {
    setFormData({
      ...formData,
      key_results: formData.key_results.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Objective Title</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Increase customer satisfaction"
          />
        </div>
        <div className="md:col-span-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the objective..."
            rows={2}
          />
        </div>
        <div>
          <Label>Start Date</Label>
          <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
        </div>
        <div>
          <Label>Target Date</Label>
          <Input type="date" value={formData.target_date} onChange={(e) => setFormData({ ...formData, target_date: e.target.value })} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="on_track">On Track</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="behind">Behind</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Align to Parent Objective</Label>
          <Select value={formData.parent_id || "__none"} onValueChange={(value) => setFormData({ ...formData, parent_id: value === "__none" ? null : value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None (Top-level)</SelectItem>
              {allObjectives
                .filter((o) => o.id !== formData.id)
                .map((o) => (
                  <SelectItem key={o.id} value={o.id!}>{o.title}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Visibility</Label>
          <Select value={formData.visibility || "team"} onValueChange={(value) => setFormData({ ...formData, visibility: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="org">Organization</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base">Key Results</Label>
          <Button type="button" variant="outline" size="sm" onClick={addKeyResult}>
            <Plus className="h-4 w-4 mr-2" />
            Add Key Result
          </Button>
        </div>

        {formData.key_results.map((kr, index) => (
          <div key={kr.id ?? `kr-${index}`} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <Input
                value={kr.title}
                onChange={(e) => updateKeyResult(index, "title", e.target.value)}
                placeholder="Key result title"
                className="flex-1 mr-2"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeKeyResult(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Start</Label>
                <Input type="number" value={kr.start_value} onChange={(e) => updateKeyResult(index, "start_value", Number.parseFloat(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Current</Label>
                <Input type="number" value={kr.current_value} onChange={(e) => updateKeyResult(index, "current_value", Number.parseFloat(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Target</Label>
                <Input type="number" value={kr.target_value} onChange={(e) => updateKeyResult(index, "target_value", Number.parseFloat(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Input value={kr.unit} onChange={(e) => updateKeyResult(index, "unit", e.target.value)} placeholder="e.g., %" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)} disabled={!formData.title.trim()}>
          {formData.id ? "Update" : "Create"} Objective
        </Button>
      </div>
    </div>
  )
}
