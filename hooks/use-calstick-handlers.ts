import { useCallback } from "react"
import { toast } from "sonner"
import type { BaseReply } from "@/components/replies/reply-shared"

/**
 * Shared CalStick handlers used by UnifiedReplies and ThreadedReplies.
 * Eliminates ~170 lines of duplication across reply components.
 */
export function useCalStickHandlers(
  setLocalReplies: React.Dispatch<React.SetStateAction<any[]>>,
  setEditingCalStick: React.Dispatch<React.SetStateAction<string | null>>,
  calStickDates: Record<string, string>,
  setCalStickDates: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  options?: {
    /** If true, uses recursive tree update (for threaded/nested replies) */
    recursive?: boolean
  },
) {
  const recursive = options?.recursive ?? false

  /** Recursively update a reply by ID in a nested tree */
  const updateReplyInTree = useCallback(
    <T extends BaseReply>(replies: T[], replyId: string, updater: (r: T) => T): T[] => {
      return replies.map((r) => {
        if (r.id === replyId) return updater(r)
        if (r.replies && r.replies.length > 0) {
          return { ...r, replies: updateReplyInTree(r.replies as T[], replyId, updater) }
        }
        return r
      })
    },
    [],
  )

  /** Update a reply by ID — flat or recursive depending on config */
  const updateReply = useCallback(
    (replyId: string, updater: (r: any) => any) => {
      if (recursive) {
        setLocalReplies((prev) => updateReplyInTree(prev, replyId, updater))
      } else {
        setLocalReplies((prev) => prev.map((r) => (r.id === replyId ? updater(r) : r)))
      }
    },
    [recursive, setLocalReplies, updateReplyInTree],
  )

  const handleToggleCalStick = useCallback(
    async (replyId: string, currentIsCalStick: boolean, currentDate: string | null) => {
      try {
        const newIsCalStick = !currentIsCalStick

        if (newIsCalStick) {
          setEditingCalStick(replyId)
          setCalStickDates((prev) => ({
            ...prev,
            [replyId]: currentDate || new Date().toISOString().split("T")[0],
          }))
          return
        }

        const response = await fetch(`/api/sticks/replies/${replyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_calstick: false,
            calstick_date: null,
            calstick_completed: false,
            calstick_completed_at: null,
          }),
        })

        if (!response.ok) throw new Error("Failed to update CalStick")

        updateReply(replyId, (r) => ({
          ...r,
          is_calstick: false,
          calstick_date: null,
          calstick_completed: false,
          calstick_completed_at: null,
        }))

        toast.success("CalStick removed")
      } catch (error) {
        console.error("Error toggling CalStick:", error)
        toast.error("Failed to update CalStick")
      }
    },
    [setEditingCalStick, setCalStickDates, updateReply],
  )

  const handleCalStickDateChange = useCallback(
    (replyId: string, date: string) => {
      setCalStickDates((prev) => ({
        ...prev,
        [replyId]: date,
      }))
    },
    [setCalStickDates],
  )

  const handleSaveCalStickDate = useCallback(
    async (replyId: string) => {
      try {
        const date = calStickDates[replyId]
        if (!date) {
          toast.error("Please select a date")
          return
        }

        const response = await fetch(`/api/sticks/replies/${replyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_calstick: true,
            calstick_date: date,
          }),
        })

        if (!response.ok) throw new Error("Failed to save CalStick date")

        updateReply(replyId, (r) => ({ ...r, is_calstick: true, calstick_date: date }))

        toast.success("CalStick task created")
        setEditingCalStick(null)
      } catch (error) {
        console.error("Error saving CalStick date:", error)
        toast.error("Failed to save CalStick date")
      }
    },
    [calStickDates, updateReply, setEditingCalStick],
  )

  const handleToggleCalStickComplete = useCallback(
    async (replyId: string, currentCompleted: boolean) => {
      try {
        const newCompleted = !currentCompleted
        const response = await fetch(`/api/sticks/replies/${replyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calstick_completed: newCompleted,
            calstick_completed_at: newCompleted ? new Date().toISOString() : null,
          }),
        })

        if (!response.ok) throw new Error("Failed to update completion status")

        updateReply(replyId, (r) => ({
          ...r,
          calstick_completed: newCompleted,
          calstick_completed_at: newCompleted ? new Date().toISOString() : null,
        }))

        toast.success(newCompleted ? "Task completed!" : "Task marked incomplete")
      } catch (error) {
        console.error("Error toggling completion:", error)
        toast.error("Failed to update task")
      }
    },
    [updateReply],
  )

  return {
    handleToggleCalStick,
    handleCalStickDateChange,
    handleSaveCalStickDate,
    handleToggleCalStickComplete,
  }
}
