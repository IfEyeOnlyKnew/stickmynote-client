"use client"

import { useCallback } from "react"
import type { Note } from "@/types/note"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/hooks/use-toast"

interface UseReplyManagementReturn {
  handleAddReply: (noteId: string, content: string) => Promise<void>
  handleEditReply: (replyId: string, content: string) => Promise<void>
  handleDeleteReply: (replyId: string) => Promise<void>
}

export function useReplyManagement(
  userId: string | null,
  setAllNotes: ((notes: Note[] | ((prev: Note[]) => Note[])) => void) | null,
): UseReplyManagementReturn {
  const handleAddReply = useCallback(
    async (noteId: string, content: string) => {
      if (!userId) {
        toast({
          title: "Authentication Required",
          description: "Please log in to add replies.",
          variant: "destructive",
        })
        return
      }

      if (!setAllNotes) {
        console.error("setAllNotes function not available")
        return
      }

      try {
        const supabase = createClient()

        type ReplyInsert = {
          id: string
          personal_stick_id: string
          user_id: string
          content: string
          color: string
          created_at: string
          updated_at: string
        }

        const { data: reply, error } = await (supabase as any)
          .from("personal_sticks_replies")
          .insert({
            personal_stick_id: noteId,
            user_id: userId,
            content: content.trim(),
            color: "#f3f4f6",
          })
          .select()
          .single()

        if (error) {
          console.error("Error adding reply:", error)
          toast({
            title: "Error",
            description: "Failed to add reply. Please try again.",
            variant: "destructive",
          })
          return
        }

        setAllNotes((prevNotes: Note[]) =>
          prevNotes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  replies: [...(note.replies || []), reply as any],
                }
              : note,
          ),
        )

        toast({
          title: "Reply Added",
          description: "Your reply has been added successfully.",
        })
      } catch (error) {
        console.error("Error adding reply:", error)
        toast({
          title: "Error",
          description: "Failed to add reply. Please try again.",
          variant: "destructive",
        })
      }
    },
    [userId, setAllNotes],
  )

  const handleEditReply = useCallback(
    async (replyId: string, content: string) => {
      if (!userId) {
        toast({
          title: "Authentication Required",
          description: "Please log in to edit replies.",
          variant: "destructive",
        })
        return
      }

      if (!setAllNotes) {
        console.error("setAllNotes function not available")
        return
      }

      try {
        const supabase = createClient()

        const { data: reply, error } = await (supabase as any)
          .from("personal_sticks_replies")
          .update({
            content: content.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", replyId)
          .eq("user_id", userId)
          .select()
          .single()

        if (error) {
          console.error("Error editing reply:", error)
          toast({
            title: "Error",
            description: "Failed to edit reply. Please try again.",
            variant: "destructive",
          })
          return
        }

        setAllNotes((prevNotes: Note[]) =>
          prevNotes.map((note) => ({
            ...note,
            replies: (note.replies || []).map((r) => (r.id === replyId ? reply : r)),
          })),
        )

        toast({
          title: "Reply Updated",
          description: "Your reply has been updated successfully.",
        })
      } catch (error) {
        console.error("Error editing reply:", error)
        toast({
          title: "Error",
          description: "Failed to edit reply. Please try again.",
          variant: "destructive",
        })
      }
    },
    [userId, setAllNotes],
  )

  const handleDeleteReply = useCallback(
    async (replyId: string) => {
      if (!userId) {
        toast({
          title: "Authentication Required",
          description: "Please log in to delete replies.",
          variant: "destructive",
        })
        return
      }

      if (!setAllNotes) {
        console.error("setAllNotes function not available")
        return
      }

      try {
        const supabase = createClient()

        const { error } = await supabase
          .from("personal_sticks_replies")
          .delete()
          .eq("id", replyId)
          .eq("user_id", userId)

        if (error) {
          console.error("Error deleting reply:", error)
          toast({
            title: "Error",
            description: "Failed to delete reply. Please try again.",
            variant: "destructive",
          })
          return
        }

        setAllNotes((prevNotes: Note[]) =>
          prevNotes.map((note) => ({
            ...note,
            replies: (note.replies || []).filter((r) => r.id !== replyId),
          })),
        )

        toast({
          title: "Reply Deleted",
          description: "Your reply has been deleted successfully.",
        })
      } catch (error) {
        console.error("Error deleting reply:", error)
        toast({
          title: "Error",
          description: "Failed to delete reply. Please try again.",
          variant: "destructive",
        })
      }
    },
    [userId, setAllNotes],
  )

  return {
    handleAddReply,
    handleEditReply,
    handleDeleteReply,
  }
}
