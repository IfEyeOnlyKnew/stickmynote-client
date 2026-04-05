"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Globe, Lock, Users } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { ManageMembersDialog } from "./manage-members-dialog"

interface PadSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pad: {
    id: string
    name: string
    description: string
    is_public: boolean
    owner_id: string
  }
  currentUserId: string
  onUpdate: () => void
}

export function PadSettingsDialog({ open, onOpenChange, pad, currentUserId, onUpdate }: Readonly<PadSettingsDialogProps>) {
  const [name, setName] = useState(pad.name)
  const [description, setDescription] = useState(pad.description || "")
  const [isPublic, setIsPublic] = useState(pad.is_public)
  const [saving, setSaving] = useState(false)
  const [showMembersDialog, setShowMembersDialog] = useState(false)
  const isOwner = pad.owner_id === currentUserId

  useEffect(() => {
    if (open) {
      setName(pad.name)
      setDescription(pad.description || "")
      setIsPublic(pad.is_public)
    }
  }, [open, pad])

  const handleSave = async () => {
    if (!name.trim()) return

    try {
      setSaving(true)
      const response = await fetch(`/api/inference-pads/${pad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          is_public: isPublic,
        }),
      })

      if (response.ok) {
        onUpdate()
        onOpenChange(false)
      } else {
        const data = await response.json()
        alert(data.error || "Failed to update pad")
      }
    } catch (error) {
      console.error("Error updating pad:", error)
      alert("Failed to update pad")
    } finally {
      setSaving(false)
    }
  }

  if (!isOwner) {
    return null
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Pad Settings
            </DialogTitle>
            <DialogDescription>Manage your inference pad settings and members</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="pad-name">Pad Name *</Label>
                <Input
                  id="pad-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g., Marketing Team, Product Ideas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pad-description">Description</Label>
                <Textarea
                  id="pad-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="What's this pad about?"
                  className="resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                      <Lock className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="public-toggle" className="text-sm font-semibold text-gray-900 cursor-pointer">
                      {isPublic ? "Public Pad" : "Private Pad"}
                    </Label>
                    <p className="text-xs text-gray-600">
                      {isPublic ? "Anyone can discover and view this pad" : "Only you and invited members can access"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="public-toggle"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  className="data-[state=checked]:bg-green-600"
                />
              </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-4 mt-4">
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="font-semibold mb-2">Manage Members</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add members, assign roles, and manage permissions for this pad
                </p>
                <Button onClick={() => setShowMembersDialog(true)} className="inference-gradient text-white">
                  <Users className="mr-2 h-4 w-4" />
                  Open Member Management
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving} className="inference-gradient text-white">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageMembersDialog
        open={showMembersDialog}
        onOpenChange={setShowMembersDialog}
        padId={pad.id}
        padName={pad.name}
      />
    </>
  )
}
