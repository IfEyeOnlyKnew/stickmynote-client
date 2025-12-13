"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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
  key_results: KeyResult[]
}

interface OKRManagerProps {
  open: boolean
  onClose: () => void
}

export function OKRManager({ open, onClose }: OKRManagerProps) {
  const { toast } = useToast()
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (open) {
      fetchObjectives()
    }
  }, [open])

  const fetchObjectives = async () => {
    try {
      const res = await fetch("/api/calsticks/objectives")
      if (res.ok) {
        const data = await res.json()
        setObjectives(data)
      }
    } catch (error) {
      console.error("Error fetching objectives:", error)
    }
  }

  const handleSaveObjective = async (objective: Objective) => {
    try {
      const method = objective.id ? "PUT" : "POST"
      const url = objective.id ? `/api/calsticks/objectives/${objective.id}` : "/api/calsticks/objectives"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objective),
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: `Objective ${objective.id ? "updated" : "created"} successfully`,
        })
        fetchObjectives()
        setShowForm(false)
        setEditingObjective(null)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save objective",
        variant: "destructive",
      })
    }
  }

  const handleDeleteObjective = async (id: string) => {
    if (!confirm("Are you sure you want to delete this objective?")) return

    try {
      const res = await fetch(`/api/calsticks/objectives/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast({
          title: "Success",
          description: "Objective deleted successfully",
        })
        fetchObjectives()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete objective",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>OKR Management</DialogTitle>
          <DialogDescription>Create and manage objectives and key results</DialogDescription>
        </DialogHeader>

        {!showForm ? (
          <div className="space-y-4">
            <Button
              onClick={() => {
                setEditingObjective({
                  title: "",
                  description: "",
                  status: "not_started",
                  start_date: new Date().toISOString().split("T")[0],
                  target_date: "",
                  key_results: [],
                })
                setShowForm(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Objective
            </Button>

            <div className="space-y-3">
              {objectives.map((obj) => (
                <div key={obj.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{obj.title}</h3>
                      <p className="text-sm text-muted-foreground">{obj.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingObjective(obj)
                          setShowForm(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteObjective(obj.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{obj.key_results?.length || 0}</span> key results
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ObjectiveForm
            objective={editingObjective!}
            onSave={handleSaveObjective}
            onCancel={() => {
              setShowForm(false)
              setEditingObjective(null)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ObjectiveForm({
  objective,
  onSave,
  onCancel,
}: {
  objective: Objective
  onSave: (obj: Objective) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<Objective>(objective)

  const addKeyResult = () => {
    setFormData({
      ...formData,
      key_results: [
        ...formData.key_results,
        {
          title: "",
          description: "",
          metric_type: "number",
          start_value: 0,
          current_value: 0,
          target_value: 100,
          unit: "",
        },
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
      <div className="space-y-4">
        <div>
          <Label>Objective Title</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Increase customer satisfaction"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the objective..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Target Date</Label>
            <Input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="on_track">On Track</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="behind">Behind</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Key Results</Label>
          <Button type="button" variant="outline" size="sm" onClick={addKeyResult}>
            <Plus className="h-4 w-4 mr-2" />
            Add Key Result
          </Button>
        </div>

        {formData.key_results.map((kr, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
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

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Start Value</Label>
                <Input
                  type="number"
                  value={kr.start_value}
                  onChange={(e) => updateKeyResult(index, "start_value", Number.parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Current Value</Label>
                <Input
                  type="number"
                  value={kr.current_value}
                  onChange={(e) => updateKeyResult(index, "current_value", Number.parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Target Value</Label>
                <Input
                  type="number"
                  value={kr.target_value}
                  onChange={(e) => updateKeyResult(index, "target_value", Number.parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Metric Type</Label>
                <Select value={kr.metric_type} onValueChange={(value) => updateKeyResult(index, "metric_type", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="currency">Currency</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Input
                  value={kr.unit}
                  onChange={(e) => updateKeyResult(index, "unit", e.target.value)}
                  placeholder="e.g., users, %, $"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(formData)}>Save Objective</Button>
      </div>
    </div>
  )
}
