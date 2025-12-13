"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface TeamNote {
  id: string
  team_id: string
  topic: string
  content: string
  details?: string
  color: string
  position_x: number
  position_y: number
  user_id: string
  created_at: string
  updated_at?: string
  tags?: string[]
  hyperlinks?: Array<{ url: string; title: string }>
  isNew?: boolean
}

interface Reply {
  id: string
  content: string
  summary: string | null
  user_id: string
  color: string
  created_at: string
  updated_at?: string
  user?: {
    username?: string
    email?: string
  }
}

interface UseTeamNoteBusinessLogicProps {
  note: TeamNote
  teamId: string
  role: string | null
  onUpdateNote: (noteId: string, updates: Partial<TeamNote>) => Promise<void>
  onCancelNewNote?: (noteId: string) => void
  onStickNewNote?: (noteId: string, updatedNote: Partial<TeamNote>) => Promise<void>
}

export function useTeamNoteBusinessLogic({
  note,
  teamId,
  role,
  onUpdateNote,
  onCancelNewNote,
  onStickNewNote,
}: UseTeamNoteBusinessLogicProps) {
  const safeNote: TeamNote = {
    id: note?.id || "",
    team_id: note?.team_id || teamId,
    topic: note?.topic || "",
    content: note?.content || "",
    details: note?.details || "",
    color: note?.color || "#fbbf24",
    position_x: note?.position_x || 0,
    position_y: note?.position_y || 0,
    user_id: note?.user_id || "",
    created_at: note?.created_at || new Date().toISOString(),
    updated_at: note?.updated_at,
    tags: note?.tags || [],
    hyperlinks: note?.hyperlinks || [],
    isNew: note?.isNew || false,
  }

  const [editedNote, setEditedNote] = useState<TeamNote>(safeNote)
  const [replies, setReplies] = useState<Reply[]>([])
  const [newReply, setNewReply] = useState("")
  const [isGeneratingTags, setIsGeneratingTags] = useState(false)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [replySummary, setReplySummary] = useState<string | null>(null)
  const [selectedTone, setSelectedTone] = useState<string>("casual")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [originalTopic, setOriginalTopic] = useState<string>("")
  const [originalContent, setOriginalContent] = useState<string>("")
  const [originalDetails, setOriginalDetails] = useState<string>("")

  const supabase = createClient()
  const canEdit = role !== "viewer"
  const replyCount = replies.length

  const tones = [
    { value: "cinematic", label: "Cinematic (Movie Script)" },
    { value: "formal", label: "Formal (Professional Report)" },
    { value: "casual", label: "Casual (Conversational)" },
    { value: "dramatic", label: "Dramatic (Novel Narrative)" },
  ]

  // Initialize original values when not editing
  useEffect(() => {
    if (!isEditing) {
      const newTopic = safeNote.topic || ""
      const newContent = safeNote.content || ""
      const newDetails = safeNote.details || ""
      setOriginalTopic(newTopic)
      setOriginalContent(newContent)
      setOriginalDetails(newDetails)
      setEditedNote((prev) => ({ ...prev, topic: newTopic, content: newContent, details: newDetails }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeNote.topic, safeNote.content, safeNote.details, isEditing])

  // Fetch replies
  useEffect(() => {
    const fetchReplies = async () => {
      if (safeNote.isNew || safeNote.id.startsWith("temp-")) return

      try {
        const { data, error } = await (supabase as any)
          .from("team_note_replies")
          .select(`
            *,
            user:users(username, email)
          `)
          .eq("team_note_id", safeNote.id)
          .order("created_at", { ascending: true })

        if (error) throw error
        setReplies(data || [])
      } catch (err) {
        setError(`Error fetching replies: ${(err as Error).message}`)
      }
    }

    fetchReplies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeNote.id, safeNote.isNew])

  // Track changes
  useEffect(() => {
    if (safeNote.isNew) {
      const hasTopicOrContent = editedNote.topic?.trim() || editedNote.content?.trim()
      setHasChanges(!!hasTopicOrContent)
    } else {
      const hasTopicChange = editedNote.topic !== originalTopic
      const hasContentChange = editedNote.content !== originalContent
      const hasDetailsChange = editedNote.details !== originalDetails
      setHasChanges(hasTopicChange || hasContentChange || hasDetailsChange)
    }
  }, [
    editedNote.topic,
    editedNote.content,
    editedNote.details,
    originalTopic,
    originalContent,
    originalDetails,
    safeNote.isNew,
  ])

  const handleGenerateTags = async () => {
    const topicText = editedNote.topic?.trim() || ""
    const contentText = editedNote.content?.trim() || ""

    if (!topicText && !contentText) {
      setError("Please add a topic or content before generating tags")
      return
    }

    console.log("[v0] Generating tags with data:", { topic: topicText, content: contentText, noteId: safeNote.id })

    setIsGeneratingTags(true)
    try {
      const response = await fetch("/api/generate-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicText,
          content: contentText,
          noteId: safeNote.id,
          isTeamNote: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate tags")
      }

      const { tags, hyperlinks } = await response.json()
      const updatedNote = { ...editedNote, tags, hyperlinks }
      setEditedNote(updatedNote)
      setError("Tags generated successfully!")
    } catch (err) {
      console.error("[v0] Error generating tags:", err)
      setError(`Error generating tags: ${(err as Error).message}`)
    } finally {
      setIsGeneratingTags(false)
    }
  }

  const handleGenerateSummary = useCallback(
    async (tone: string) => {
      if (replies.length === 0) {
        setError("No replies to summarize.")
        return
      }

      if (isGeneratingSummary) return

      setIsGeneratingSummary(true)
      setSelectedTone(tone)
      try {
        const response = await fetch("/api/summarize-replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId: safeNote.id,
            tone: tone,
            isTeamNote: true,
            replies: replies.map((reply) => ({
              content: reply.content,
              user: reply.user?.username || reply.user?.email || "User",
              created_at: reply.created_at,
            })),
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to generate summary: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        setReplySummary(data.summary)
      } catch (err) {
        setError(`Error generating summary: ${(err as Error).message}`)
      } finally {
        setIsGeneratingSummary(false)
      }
    },
    [replies, isGeneratingSummary, safeNote.id],
  )

  const handleGenerateSummaryDocx = useCallback(
    async (tone: string) => {
      if (replies.length === 0) {
        setError("No replies to summarize.")
        return
      }

      if (isGeneratingSummary) return

      setIsGeneratingSummary(true)
      setSelectedTone(tone)
      try {
        const response = await fetch("/api/summarize-replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId: safeNote.id,
            tone: tone,
            isTeamNote: true,
            generateDocx: true,
            replies: replies.map((reply) => ({
              content: reply.content,
              user: reply.user?.username || reply.user?.email || "User",
              created_at: reply.created_at,
            })),
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to generate summary document: ${response.status} - ${errorText}`)
        }

        const data = await response.json()

        if (data.docxUrl) {
          window.open(data.docxUrl, "_blank")
          setError("Summary document generated! Download started.")
        } else {
          setReplySummary(data.summary)
        }
      } catch (err) {
        setError(`Error generating summary document: ${(err as Error).message}`)
      } finally {
        setIsGeneratingSummary(false)
      }
    },
    [replies, isGeneratingSummary, safeNote.id],
  )

  const handleExportAll = useCallback(async () => {
    if (isExporting) return

    setIsExporting(true)
    try {
      const response = await fetch("/api/export-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId: safeNote.id,
          isTeamNote: true,
          teamId: teamId,
          tone: selectedTone,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to export note: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      if (data.success) {
        if (typeof window !== "undefined" && (window as any).refreshTeamNoteTabs) {
          await (window as any).refreshTeamNoteTabs()
        }
        setError("Export completed! Check the Details tab for the download link.")
      }
    } catch (err) {
      setError(`Error exporting note: ${(err as Error).message}`)
    } finally {
      setIsExporting(false)
    }
  }, [isExporting, safeNote.id, teamId, selectedTone])

  const handleSubmitReply = async () => {
    if (!newReply.trim() || safeNote.isNew || isSubmittingReply) return

    setIsSubmittingReply(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await (supabase as any).from("team_note_replies").insert({
        team_note_id: safeNote.id,
        content: newReply.trim(),
        user_id: user.id,
        color: "#f3f4f6",
      })

      if (error) throw error

      setNewReply("")

      const { data: updatedReplies } = await supabase
        .from("team_note_replies")
        .select(`
          *,
          user:users(username, email)
        `)
        .eq("team_note_id", safeNote.id)
        .order("created_at", { ascending: true })

      setReplies(updatedReplies || [])
    } catch (err) {
      setError(`Error submitting reply: ${(err as Error).message}`)
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const handleCancelNewNote = () => {
    if (onCancelNewNote) {
      onCancelNewNote(safeNote.id)
    }
  }

  const handleStickNewNote = async () => {
    if (!hasChanges) return

    try {
      if (onStickNewNote) {
        await onStickNewNote(safeNote.id, {
          topic: editedNote.topic,
          content: editedNote.content,
          details: editedNote.details,
        })
      }
    } catch (err) {
      setError(`Error saving note: ${(err as Error).message}`)
    }
  }

  const handleStartEditing = useCallback(() => {
    if (!safeNote.isNew && !isEditing) {
      setIsEditing(true)
      const newTopic = safeNote.topic || ""
      const newContent = safeNote.content || ""
      const newDetails = safeNote.details || ""
      setOriginalTopic(newTopic)
      setOriginalContent(newContent)
      setOriginalDetails(newDetails)
      setEditedNote((prev) => ({ ...prev, topic: newTopic, content: newContent, details: newDetails }))
    }
  }, [safeNote.isNew, isEditing, safeNote.topic, safeNote.content, safeNote.details])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditedNote((prev) => ({
      ...prev,
      topic: originalTopic,
      content: originalContent,
      details: originalDetails,
    }))
    setHasChanges(false)
  }, [originalTopic, originalContent, originalDetails])

  const handleStickEdit = useCallback(async () => {
    if (!hasChanges || isSaving || !editedNote.content?.trim()) return

    setIsSaving(true)
    try {
      await onUpdateNote(safeNote.id, {
        topic: editedNote.topic,
        content: editedNote.content,
        details: editedNote.details,
      })

      setOriginalTopic(editedNote.topic || "")
      setOriginalContent(editedNote.content || "")
      setOriginalDetails(editedNote.details || "")
      setIsEditing(false)
      setHasChanges(false)
    } catch (err) {
      setError(`Error saving note: ${(err as Error).message}`)
    } finally {
      setIsSaving(false)
    }
  }, [hasChanges, isSaving, editedNote, safeNote.id, onUpdateNote])

  return {
    // State
    editedNote,
    setEditedNote,
    replies,
    newReply,
    setNewReply,
    isGeneratingTags,
    isGeneratingSummary,
    isExporting,
    replySummary,
    selectedTone,
    setSelectedTone,
    isSubmittingReply,
    error,
    setError,
    hasChanges,
    isEditing,
    isSaving,
    canEdit,
    replyCount,
    tones,

    // Handlers
    handleGenerateTags,
    handleGenerateSummary,
    handleGenerateSummaryDocx,
    handleExportAll,
    handleSubmitReply,
    handleCancelNewNote,
    handleStickNewNote,
    handleStartEditing,
    handleCancelEdit,
    handleStickEdit,
  }
}
