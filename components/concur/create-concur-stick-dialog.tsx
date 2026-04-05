"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const COLORS = [
  "#fef08a", "#fecaca", "#bbf7d0", "#bfdbfe", "#ddd6fe",
  "#fed7aa", "#fbcfe8", "#f3f4f6", "#cffafe", "#e0e7ff",
]

interface CreateConcurStickDialogProps {
  groupId: string
  onClose: () => void
  onCreated: () => void
}

export function CreateConcurStickDialog({ groupId, onClose, onCreated }: Readonly<CreateConcurStickDialogProps>) {
  const { toast } = useToast()
  const [topic, setTopic] = useState("")
  const [content, setContent] = useState("")
  const [color, setColor] = useState(COLORS[0])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({ title: "Content is required", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/concur/groups/${groupId}/sticks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim() || null,
          content: content.trim(),
          color,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast({ title: data.error || "Failed to create stick", variant: "destructive" })
        return
      }

      toast({ title: "Stick created!" })
      onCreated()
    } catch {
      toast({ title: "Failed to create stick", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Stick</DialogTitle>
          <DialogDescription>
            Share a discussion topic with the group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="topic">Topic (optional)</Label>
            <Input
              id="topic"
              placeholder="Enter a topic..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={75}
            />
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="What would you like to share?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {content.length}/1000
            </p>
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={`Select color ${c}`}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    color === c ? "border-gray-800 scale-110" : "border-gray-200"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
