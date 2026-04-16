"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Trash2 } from "lucide-react"
import type { MemberPermissions } from "@/types/permissions"

interface PermissionPreset {
  id: string
  name: string
  description: string
  permissions: MemberPermissions
}

interface PermissionPresetsManagerProps {
  onApplyPreset: (permissions: MemberPermissions) => void
}

export function PermissionPresetsManager({ onApplyPreset }: Readonly<PermissionPresetsManagerProps>) {
  const [presets, setPresets] = useState<PermissionPreset[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<PermissionPreset | null>(null)
  void editingPreset
  const [presetName, setPresetName] = useState("")
  const [presetDescription, setPresetDescription] = useState("")

  useEffect(() => {
    loadPresets()
  }, [])

  const loadPresets = () => {
    const stored = localStorage.getItem("permission-presets")
    if (stored) {
      setPresets(JSON.parse(stored))
    }
  }

  const savePresets = (newPresets: PermissionPreset[]) => {
    localStorage.setItem("permission-presets", JSON.stringify(newPresets))
    setPresets(newPresets)
  }

  const createPreset = (permissions: MemberPermissions) => {
    const newPreset: PermissionPreset = {
      id: Date.now().toString(),
      name: presetName,
      description: presetDescription,
      permissions,
    }

    savePresets([...presets, newPreset])
    setDialogOpen(false)
    resetForm()
  }

  const deletePreset = (presetId: string) => {
    savePresets(presets.filter((p) => p.id !== presetId))
  }

  const resetForm = () => {
    setPresetName("")
    setPresetDescription("")
    setEditingPreset(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Custom Permission Presets</CardTitle>
            <CardDescription className="text-xs">Save and reuse custom permission configurations</CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Preset
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {presets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No custom presets yet</p>
            <p className="text-xs mt-1">Create presets to quickly apply permission configurations</p>
          </div>
        ) : (
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{preset.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(preset.permissions)
                        .filter(([_, value]) => value)
                        .map(([key]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key.replace("can_", "").replaceAll("_", " ")}
                          </Badge>
                        ))}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button size="sm" variant="outline" onClick={() => onApplyPreset(preset.permissions)}>
                      Apply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deletePreset(preset.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Permission Preset</DialogTitle>
            <DialogDescription>Save your current permission configuration as a reusable preset</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., Content Moderator"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-description">Description</Label>
              <Input
                id="preset-description"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                placeholder="Brief description of this permission set"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createPreset({
                  can_create_sticks: true,
                  can_reply: true,
                  can_edit_others_sticks: false,
                  can_delete_others_sticks: false,
                  can_invite_members: false,
                  can_pin_sticks: false,
                })
              }
              disabled={!presetName.trim()}
            >
              Create Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
