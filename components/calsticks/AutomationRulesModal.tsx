"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, Zap } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { AutomationRule, TriggerEvent, ActionType } from "@/types/automation"

interface AutomationRulesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AutomationRulesModal({ isOpen, onClose }: AutomationRulesModalProps) {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  // New Rule State
  const [newName, setNewName] = useState("")
  const [newTrigger, setNewTrigger] = useState<TriggerEvent>("task_completed")
  const [newAction, setNewAction] = useState<ActionType>("send_notification")
  const [actionConfig, setActionConfig] = useState<string>("") // Simple message for now

  useEffect(() => {
    if (isOpen) fetchRules()
  }, [isOpen])

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/automation/rules")
      const data = await res.json()
      if (data.rules) setRules(data.rules)
    } catch (error) {
      console.error("Error fetching rules:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRule = async () => {
    if (!newName) return

    try {
      const payload = {
        name: newName,
        trigger_event: newTrigger,
        action_type: newAction,
        action_config: { message: actionConfig }, // Simplified
        trigger_conditions: {}, // Empty for now
        is_active: true,
      }

      const res = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to create rule")

      const data = await res.json()
      setRules([data.rule, ...rules])
      setIsCreating(false)
      setNewName("")
      toast({ title: "Rule Created", description: "Your automation rule is active." })
    } catch (error) {
      toast({ title: "Error", description: "Could not create rule", variant: "destructive" })
    }
  }

  const handleDeleteRule = async (id: string) => {
    // TODO: Implement delete API
    // Optimistic update
    setRules(rules.filter((r) => r.id !== id))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Automation Rules
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!isCreating ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Automate your workflow with simple &quot;If this, then that&quot; rules.
                </p>
                <Button onClick={() => setIsCreating(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Rule
                </Button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {rules.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">No rules yet.</p>
                  </div>
                ) : (
                  rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div>
                        <h4 className="font-medium">{rule.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          When <b>{rule.trigger_event.replace("_", " ")}</b> →{" "}
                          <b>{rule.action_type.replace("_", " ")}</b>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={rule.is_active} />
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 border p-4 rounded-lg">
              <div className="grid gap-2">
                <Label>Rule Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Notify me when task is done"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>When...</Label>
                  <Select value={newTrigger} onValueChange={(v: TriggerEvent) => setNewTrigger(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task_completed">Task is Completed</SelectItem>
                      <SelectItem value="task_created">Task is Created</SelectItem>
                      <SelectItem value="priority_changed">Priority Changes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Then...</Label>
                  <Select value={newAction} onValueChange={(v: ActionType) => setNewAction(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="send_notification">Send Notification</SelectItem>
                      <SelectItem value="send_email">Send Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Action Message</Label>
                <Input
                  value={actionConfig}
                  onChange={(e) => setActionConfig(e.target.value)}
                  placeholder="Notification message..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRule}>Create Rule</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
