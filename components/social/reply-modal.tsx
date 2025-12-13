"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send } from "lucide-react"

export const REPLY_CATEGORIES = [
  { value: "Default", label: "Default", description: "General reply without specific category" },
  { value: "Answer", label: "Answer", description: "Direct response to the original topic" },
  { value: "Bug Report", label: "Bug Report", description: "Identifies a problem or error" },
  { value: "Clarification", label: "Clarification", description: "Seeks or provides additional detail" },
  { value: "Correction", label: "Correction", description: "Fixes or updates incorrect information" },
  { value: "Enhancement Request", label: "Enhancement Request", description: "Suggests a feature or improvement" },
  { value: "FAQ", label: "FAQ", description: "Addresses a frequently asked question" },
  { value: "Feedback", label: "Feedback", description: "General thoughts or opinions" },
  { value: "Follow-up Question", label: "Follow-up Question", description: "New question related to the topic" },
  { value: "Opinion", label: "Opinion", description: "Expresses a personal viewpoint" },
  { value: "Reference", label: "Reference", description: "Provides a link or source" },
  { value: "Status Update", label: "Status Update", description: "Shares progress or current state" },
  { value: "Support Request", label: "Support Request", description: "Asks for help or assistance" },
  { value: "Use Case", label: "Use Case", description: "Describes a scenario or example" },
] as const

interface ReplyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (content: string, category: string) => Promise<void>
  parentReplyContent?: string
  title?: string
}

export function ReplyModal({ open, onOpenChange, onSubmit, parentReplyContent, title = "Add Reply" }: ReplyModalProps) {
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("Default")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return

    try {
      setSubmitting(true)
      await onSubmit(content, category)
      setContent("")
      setCategory("Default")
      onOpenChange(false)
    } catch (error) {
      console.error("Error submitting reply:", error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {parentReplyContent ? "Reply to an existing comment" : "Add a new reply to this stick"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {parentReplyContent && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Replying to:</p>
              <p className="text-gray-800 text-sm">{parentReplyContent}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {REPLY_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{cat.label}</span>
                      <span className="text-xs text-gray-500">{cat.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder="Write your reply..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            maxLength={1000}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{content.length}/1000</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!content.trim() || submitting}>
                <Send className="h-4 w-4 mr-2" />
                {submitting ? "Sticking..." : "Stick"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
