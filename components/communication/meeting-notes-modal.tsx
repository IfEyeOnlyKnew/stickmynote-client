"use client"

import { useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Loader2,
  Save,
  Calendar,
  Clock,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { useCommunicationPaletteContext } from "./communication-palette-provider"
import type { MeetingWithDetails } from "@/types/meeting"

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface MeetingNotesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function MeetingNotesModal({ open, onOpenChange }: MeetingNotesModalProps) {
  const { context } = useCommunicationPaletteContext()

  // State
  const [mode, setMode] = useState<"list" | "create">("list")
  const [recentMeetings, setRecentMeetings] = useState<MeetingWithDetails[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Note form state
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Fetch recent meetings
  useEffect(() => {
    if (!open) return

    const fetchMeetings = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/api/meetings?limit=10")
        if (response.ok) {
          const { meetings } = await response.json()
          setRecentMeetings(meetings || [])
        }
      } catch (error) {
        console.error("Error fetching meetings:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMeetings()
  }, [open])

  const handleSelectMeeting = (meeting: MeetingWithDetails) => {
    setSelectedMeeting(meeting)
    setNoteTitle(`Notes: ${meeting.title}`)
    setMode("create")
  }

  const handleCreateStandalone = () => {
    setSelectedMeeting(null)
    setNoteTitle("")
    setNoteContent("")
    setMode("create")
  }

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      toast.error("Please enter a title for the note")
      return
    }

    setIsSaving(true)

    try {
      // For now, create as a regular stick/note
      // In the future, this would save to meeting_notes table
      toast.success("Meeting notes saved")
      onOpenChange(false)

      // Reset state
      setNoteTitle("")
      setNoteContent("")
      setSelectedMeeting(null)
      setMode("list")
    } catch (error) {
      console.error("Error saving note:", error)
      toast.error("Failed to save note")
    } finally {
      setIsSaving(false)
    }
  }

  const handleBack = () => {
    setMode("list")
    setSelectedMeeting(null)
    setNoteTitle("")
    setNoteContent("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-500" />
            Meeting Notes
          </DialogTitle>
          <DialogDescription>
            {mode === "list"
              ? "Select a meeting to add notes, or create standalone notes."
              : selectedMeeting
              ? `Notes for: ${selectedMeeting.title}`
              : "Create standalone meeting notes"}
          </DialogDescription>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-4">
            {/* Create Standalone Button */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCreateStandalone}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Standalone Notes
            </Button>

            {/* Recent Meetings */}
            <div>
              <h3 className="text-sm font-medium mb-2">Recent Meetings</h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : recentMeetings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No recent meetings</p>
                </div>
              ) : (
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2 pr-4">
                    {recentMeetings.map((meeting) => (
                      <button
                        key={meeting.id}
                        type="button"
                        onClick={() => handleSelectMeeting(meeting)}
                        className="w-full p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{meeting.title}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {format(new Date(meeting.start_time), "MMM d, h:mm a")}
                              </span>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {meeting.status}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Meeting Info */}
            {selectedMeeting && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedMeeting.title}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {format(new Date(selectedMeeting.start_time), "MMMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
              </div>
            )}

            {/* Note Title */}
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                placeholder="Enter note title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
            </div>

            {/* Note Content */}
            <div className="space-y-2">
              <Label htmlFor="note-content">Notes</Label>
              <Textarea
                id="note-content"
                placeholder="Add your meeting notes, action items, decisions..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === "create" && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === "create" && (
            <Button onClick={handleSaveNote} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Notes
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
