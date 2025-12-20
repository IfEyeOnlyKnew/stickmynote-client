"use client"

import { useCallback } from "react"
import type { Note } from "@/types/note"
import { toast } from "@/hooks/use-toast"

interface UseReplyManagementReturn {
  handleAddReply: (noteId: string, content: string) => Promise<void>
  handleEditReply: (replyId: string, content: string) => Promise<void>
  handleDeleteReply: (replyId: string) => Promise<void>
}

// Helper: Show error toast
function showErrorToast(title: string, description: string) {
  toast({ title, description, variant: "destructive" })
}

// Helper: Show success toast
function showSuccessToast(title: string, description: string) {
  toast({ title, description })
}

// Helper: Check auth and setAllNotes availability
function validateContext(
  userId: string | null,
  setAllNotes: ((notes: Note[] | ((prev: Note[]) => Note[])) => void) | null,
  action: string
): boolean {
  if (!userId) {
    showErrorToast("Authentication Required", `Please log in to ${action} replies.`)
    return false
  }
  if (!setAllNotes) {
    console.error("setAllNotes function not available")
    return false
  }
  return true
}

// API: Add reply
async function addReplyApi(noteId: string, content: string): Promise<{ reply?: any; error?: string }> {
  try {
    const response = await fetch(`/api/notes/${noteId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), color: "#f3f4f6" }),
    })
    if (!response.ok) {
      const errorData = await response.json()
      return { error: errorData.error || "Failed to add reply" }
    }
    const reply = await response.json()
    return { reply }
  } catch {
    return { error: "Failed to add reply. Please try again." }
  }
}

// API: Edit reply
async function editReplyApi(replyId: string, content: string): Promise<{ reply?: any; error?: string }> {
  try {
    const response = await fetch(`/api/replies/${replyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    })
    if (!response.ok) {
      const errorData = await response.json()
      return { error: errorData.error || "Failed to edit reply" }
    }
    const reply = await response.json()
    return { reply }
  } catch {
    return { error: "Failed to edit reply. Please try again." }
  }
}

// API: Delete reply
async function deleteReplyApi(replyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/replies/${replyId}`, { method: "DELETE" })
    if (!response.ok) {
      const errorData = await response.json()
      return { success: false, error: errorData.error || "Failed to delete reply" }
    }
    return { success: true }
  } catch {
    return { success: false, error: "Failed to delete reply. Please try again." }
  }
}

// Note updaters to avoid deeply nested callbacks
function createAddReplyUpdater(noteId: string, reply: any) {
  return (prevNotes: Note[]): Note[] =>
    prevNotes.map((note) =>
      note.id === noteId
        ? { ...note, replies: [...(note.replies || []), reply] }
        : note
    )
}

function createEditReplyUpdater(replyId: string, updatedReply: any) {
  return (prevNotes: Note[]): Note[] =>
    prevNotes.map((note) => ({
      ...note,
      replies: (note.replies || []).map((r) =>
        r.id === replyId ? { ...r, ...updatedReply } : r
      ),
    }))
}

function createDeleteReplyUpdater(replyId: string) {
  return (prevNotes: Note[]): Note[] =>
    prevNotes.map((note) => ({
      ...note,
      replies: (note.replies || []).filter((r) => r.id !== replyId),
    }))
}

export function useReplyManagement(
  userId: string | null,
  setAllNotes: ((notes: Note[] | ((prev: Note[]) => Note[])) => void) | null,
): UseReplyManagementReturn {
  const handleAddReply = useCallback(
    async (noteId: string, content: string) => {
      if (!validateContext(userId, setAllNotes, "add")) return

      const result = await addReplyApi(noteId, content)
      
      if (result.error) {
        showErrorToast("Error", result.error)
        return
      }

      setAllNotes!(createAddReplyUpdater(noteId, result.reply))
      showSuccessToast("Reply Added", "Your reply has been added successfully.")
    },
    [userId, setAllNotes]
  )

  const handleEditReply = useCallback(
    async (replyId: string, content: string) => {
      if (!validateContext(userId, setAllNotes, "edit")) return

      const result = await editReplyApi(replyId, content)
      
      if (result.error) {
        showErrorToast("Error", result.error)
        return
      }

      setAllNotes!(createEditReplyUpdater(replyId, result.reply))
      showSuccessToast("Reply Updated", "Your reply has been updated successfully.")
    },
    [userId, setAllNotes]
  )

  const handleDeleteReply = useCallback(
    async (replyId: string) => {
      if (!validateContext(userId, setAllNotes, "delete")) return

      const result = await deleteReplyApi(replyId)
      
      if (!result.success) {
        showErrorToast("Error", result.error || "Failed to delete reply")
        return
      }

      setAllNotes!(createDeleteReplyUpdater(replyId))
      showSuccessToast("Reply Deleted", "Your reply has been deleted successfully.")
    },
    [userId, setAllNotes]
  )

  return {
    handleAddReply,
    handleEditReply,
    handleDeleteReply,
  }
}
