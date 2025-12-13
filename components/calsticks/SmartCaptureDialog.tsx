"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ParsedTask {
  title: string
  description?: string
  date?: string
  priority?: "low" | "medium" | "high"
  tags?: string[]
  estimatedHours?: number
}

interface SmartCaptureDialogProps {
  isOpen: boolean
  onClose: () => void
  onTasksParsed: (tasks: ParsedTask[]) => Promise<void>
}

export function SmartCaptureDialog({ isOpen, onClose, onTasksParsed }: SmartCaptureDialogProps) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleParse = async () => {
    if (!input.trim()) return

    setLoading(true)
    try {
      const response = await fetch("/api/calsticks/smart-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      })

      if (!response.ok) throw new Error("Failed to parse tasks")

      const { tasks } = await response.json()

      if (tasks && tasks.length > 0) {
        await onTasksParsed(tasks)
        setInput("")
        onClose()
        toast({
          title: "Success",
          description: `Parsed ${tasks.length} task${tasks.length > 1 ? "s" : ""} from your input`,
        })
      } else {
        toast({
          title: "No tasks found",
          description: "Couldn't extract any tasks from the text. Try being more specific.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error parsing tasks:", error)
      toast({
        title: "Error",
        description: "Failed to parse tasks. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Smart Capture
          </DialogTitle>
          <DialogDescription>
            Paste or type a brain dump and AI will extract individual tasks with dates, priorities, and tags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Textarea
            placeholder="Example: Meeting with John on Friday at 2pm about Q4 planning. Also need to buy milk and finish the presentation by Wednesday."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            className="resize-none"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleParse} disabled={!input.trim() || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Parse Tasks
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
