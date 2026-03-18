"use client"

import type React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useCreateStick } from "@/hooks/use-create-stick"
import { useAutoSaveDraft } from "@/hooks/use-auto-save-draft"
import { DraftPicker } from "@/components/inference/draft-picker"
import { TemplatePicker } from "@/components/inference/template-picker"
import { Save, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { StickDraft } from "@/lib/draft-storage"
import type { StickTemplate } from "@/types/templates"

interface CreateStickModalProps {
  isOpen: boolean
  onClose: () => void
  padId: string
  context?: "paks" | "social"
}

export function CreateStickModal({ isOpen, onClose, padId, context = "paks" }: CreateStickModalProps) {
  const { form, updateForm, resetForm, createStick, isLoading, isValid } = useCreateStick(padId, context)

  const { lastSaved, isSaving, deleteDraft } = useAutoSaveDraft({
    padId,
    topic: form.topic,
    content: form.content,
    enabled: isOpen && (form.topic.trim() !== "" || form.content.trim() !== ""),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    const stickData = {
      ...form,
      color: "#fbbf24", // Default yellow color for sticks
    }

    const success = await createStick(stickData)

    if (success) {
      deleteDraft()
      resetForm()
      onClose()
    }
  }

  const handleClose = () => {
    // Don't delete draft on close - user might want to come back to it
    resetForm()
    onClose()
  }

  const handleDraftSelect = (draft: StickDraft) => {
    updateForm("topic", draft.topic)
    updateForm("content", draft.content)
  }

  const handleTemplateSelect = (template: StickTemplate) => {
    updateForm("topic", template.topic_template || "")
    updateForm("content", template.content_template)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Create New Stick</DialogTitle>
              <DialogDescription>Add a new stick to your pad with a topic and content</DialogDescription>
            </div>
            <div className="flex gap-2">
              <TemplatePicker onTemplateSelect={handleTemplateSelect} />
              <DraftPicker padId={padId} onDraftSelect={handleDraftSelect} />
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              placeholder="Enter stick topic..."
              value={form.topic}
              onChange={(e) => updateForm("topic", e.target.value)}
              maxLength={75}
            />
            <p className="text-xs text-muted-foreground">{form.topic.length}/75 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              placeholder="Enter stick content..."
              value={form.content}
              onChange={(e) => updateForm("content", e.target.value)}
              maxLength={1000}
              rows={4}
              required
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{form.content.length}/1000 characters</span>
              {lastSaved && (
                <div className="flex items-center gap-1">
                  {isSaving ? (
                    <>
                      <Save className="h-3 w-3 animate-pulse" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      <span>Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? "Creating..." : "Create Stick"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
