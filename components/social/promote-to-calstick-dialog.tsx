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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Flag, ArrowRight, CheckCircle2 } from "lucide-react"

interface PromoteToCalStickDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  replyId: string
  replyContent: string
  stickTopic?: string
  onPromote: (data: { priority: string; dueDate: string; assigneeId?: string }) => Promise<void>
}

export function PromoteToCalStickDialog({
  open,
  onOpenChange,
  stickId,
  replyId,
  replyContent,
  stickTopic,
  onPromote,
}: PromoteToCalStickDialogProps) {
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState("")
  const [isPromoting, setIsPromoting] = useState(false)
  const [promoted, setPromoted] = useState(false)

  const handlePromote = async () => {
    setIsPromoting(true)
    try {
      await onPromote({ priority, dueDate })
      setPromoted(true)
      setTimeout(() => {
        onOpenChange(false)
        setPromoted(false)
        // Reset form state
        setPriority("medium")
        setDueDate("")
      }, 1500)
    } catch (error) {
      console.error("Error promoting to CalStick:", error)
    } finally {
      setIsPromoting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-purple-600" />
            Promote Reply to CalStick
          </DialogTitle>
          <DialogDescription>
            Convert this reply into an actionable task in CalSticks for execution tracking.
          </DialogDescription>
        </DialogHeader>

        {promoted ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium text-green-700">Successfully Promoted!</p>
            <p className="text-sm text-muted-foreground">The task has been created in CalSticks</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {stickTopic && (
                <div className="bg-muted/30 rounded-lg p-3 border-l-2 border-purple-400">
                  <p className="text-xs font-medium text-muted-foreground mb-1">From Topic</p>
                  <p className="text-sm font-medium">{stickTopic}</p>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium text-muted-foreground mb-1">Reply Content</p>
                <p className="text-sm line-clamp-3">{replyContent}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className="flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  Priority
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">
                      <span className="text-red-600">Urgent</span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="text-orange-600">High</span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="text-yellow-600">Medium</span>
                    </SelectItem>
                    <SelectItem value="low">
                      <span className="text-green-600">Low</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due Date (Optional)
                </Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handlePromote} disabled={isPromoting} className="bg-purple-600 hover:bg-purple-700">
                {isPromoting ? "Promoting..." : "Promote to CalStick"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
