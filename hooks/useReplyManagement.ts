"use client"

import { useCallback, useRef } from "react"
import type { Note } from "@/types/note"
import { toast } from "@/hooks/use-toast"
import { useCSRF } from "@/hooks/useCSRF"

interface UseReplyManagementReturn {
  handleAddReply: (noteId: string, content: string) => Promise<void>
  handleEditReply: (noteId: string, replyId: string, content: string) => Promise<void>
  handleDeleteReply: (noteId: string, replyId: string) => Promise<void>
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
async function addReplyApi(noteId: string, content: string, csrfToken: string | null): Promise<{ reply?: any; error?: string }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken
    }
    const response = await fetch(`/api/notes/${noteId}/replies`, {
      method: "POST",
      headers,
      credentials: "include",
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
async function editReplyApi(noteId: string, replyId: string, content: string, csrfToken: string | null): Promise<{ reply?: any; error?: string }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken
    }
    const response = await fetch(`/api/notes/${noteId}/replies`, {
      method: "PUT",
      headers,
      credentials: "include",
      body: JSON.stringify({ replyId, content: content.trim() }),
    })
    if (!response.ok) {
      const errorData = await response.json()
      return { error: errorData.error || "Failed to edit reply" }
    }
    const data = await response.json()
    return { reply: data.reply }
  } catch {
    return { error: "Failed to edit reply. Please try again." }
  }
}

// API: Delete reply
async function deleteReplyApi(noteId: string, replyId: string, csrfToken: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken
    }
    const response = await fetch(`/api/notes/${noteId}/replies`, {
      method: "DELETE",
      headers,
      credentials: "include",
      body: JSON.stringify({ replyId }),
    })
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
  const { csrfToken } = useCSRF()
  const csrfTokenRef = useRef<string | null>(null)

  // Keep ref in sync with token - this runs on every render to catch updates
  csrfTokenRef.current = csrfToken

  const handleAddReply = useCallback(
    async (noteId: string, content: string) => {
      if (!validateContext(userId, setAllNotes, "add")) return

      // Use current token value at time of call
      const currentToken = csrfTokenRef.current
      console.log("[useReplyManagement] Adding reply, CSRF token:", currentToken ? `present (${currentToken.substring(0, 30)}...)` : "MISSING")
      const result = await addReplyApi(noteId, content, currentToken)

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
    async (noteId: string, replyId: string, content: string) => {
      if (!validateContext(userId, setAllNotes, "edit")) return

      const result = await editReplyApi(noteId, replyId, content, csrfTokenRef.current)

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
    async (noteId: string, replyId: string) => {
      if (!validateContext(userId, setAllNotes, "delete")) return

      const result = await deleteReplyApi(noteId, replyId, csrfTokenRef.current)

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
