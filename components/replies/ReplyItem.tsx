"use client"

import { useState } from "react"
import { Trash2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getTimestampDisplay } from "@/utils/noteUtils"
import { CalStickControls } from "./CalStickControls"
import type React from "react"

interface Reply {
  id: string
  content: string
  color?: string
  created_at: string
  updated_at?: string
  user_id?: string
  user?: {
    username?: string
    email?: string
  }
  is_calstick?: boolean
  calstick_date?: string | null
  calstick_completed?: boolean
  calstick_completed_at?: string | null
}

interface ReplyItemProps {
  reply: Reply
  context: string
  supportsCalStick: boolean
  editingCalStick: string | null
  calStickDate: string
  currentUserId?: string | null
  onDelete?: (replyId: string) => void
  onEdit?: (replyId: string, content: string) => Promise<void>
  onToggleCalStick: (replyId: string, currentIsCalStick: boolean, currentDate: string | null) => void
  onCalStickDateChange: (replyId: string, date: string) => void
  onSaveCalStickDate: (replyId: string) => void
  onCancelCalStickEdit: () => void
  onToggleCalStickComplete: (replyId: string, currentCompleted: boolean) => void
}

export const ReplyItem: React.FC<ReplyItemProps> = ({
  reply,
  context,
  supportsCalStick,
  editingCalStick,
  calStickDate,
  currentUserId,
  onDelete,
  onEdit,
  onToggleCalStick,
  onCalStickDateChange,
  onSaveCalStickDate,
  onCancelCalStickEdit,
  onToggleCalStickComplete,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(reply.content)
  const [isSaving, setIsSaving] = useState(false)

  const timestamp = reply.updated_at || reply.created_at
  const displayTime = timestamp ? getTimestampDisplay(timestamp) : "Just now"
  const wasEdited = reply.updated_at && reply.updated_at !== reply.created_at

  const isOwner = currentUserId && reply.user_id && currentUserId === reply.user_id

  const handleStartEdit = () => {
    setEditContent(reply.content)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditContent(reply.content)
    setIsEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!onEdit || !editContent.trim() || editContent.trim() === reply.content) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onEdit(reply.id, editContent.trim())
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving reply edit:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <li
      className="bg-gray-50 rounded-lg p-3 border border-l-4 group"
      style={
        { "--reply-color": reply.color || "#d1d5db", borderLeftColor: reply.color || "#d1d5db" } as React.CSSProperties
      }
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-600">
            <span className="font-medium">{reply.user?.username || reply.user?.email || "User"}</span>
            <span className="text-gray-500"> · </span>
            <span>{displayTime}</span>
            {wasEdited && <span className="text-gray-400 ml-1">(edited)</span>}
          </div>
          {isOwner && !isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEdit}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                  title="Edit reply"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(reply.id)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  title="Delete reply"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="text-sm text-gray-900 min-h-[60px] resize-none"
              maxLength={1000}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{editContent.length}/1000</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editContent.trim()}
                  className="h-6 px-2 text-xs"
                >
                  {isSaving ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Stick
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{reply.content}</div>
        )}

        {supportsCalStick && !isEditing && (
          <CalStickControls
            replyId={reply.id}
            context={context}
            isCalStick={reply.is_calstick || false}
            calStickDate={reply.calstick_date || null}
            calStickCompleted={reply.calstick_completed || false}
            isEditing={editingCalStick === reply.id}
            editingDate={calStickDate}
            onToggle={onToggleCalStick}
            onDateChange={(date) => onCalStickDateChange(reply.id, date)}
            onSave={onSaveCalStickDate}
            onCancel={onCancelCalStickEdit}
            onToggleComplete={onToggleCalStickComplete}
          />
        )}
      </div>
    </li>
  )
}
