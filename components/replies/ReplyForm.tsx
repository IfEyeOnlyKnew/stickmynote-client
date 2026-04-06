"use client"

import type React from "react"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TextAreaField } from "@/components/forms/TextAreaField"

interface ReplyFormProps {
  content: string
  onContentChange: (content: string) => void
  onSubmit: (e: React.MouseEvent) => void
  onCancel?: (e: React.MouseEvent) => void
  isSubmitting: boolean
  isCompact?: boolean
  maxLength?: number
}

export const ReplyForm: React.FC<ReplyFormProps> = ({
  content,
  onContentChange,
  onSubmit,
  onCancel,
  isSubmitting,
  isCompact = false,
  maxLength = 1000,
}) => {
  if (isCompact) {
    return (
      <div
        role="group"
        className="reply-form-container space-y-3 p-4 bg-white rounded-md border-2 border-blue-300 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">Add Reply</h4>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-5 w-5 p-0" title="Cancel">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <TextAreaField
          label=""
          placeholder="Write your reply..."
          value={content}
          onChange={onContentChange}
          maxLength={maxLength}
          showCharCount={true}
          rows={4}
          className="min-h-[100px] text-sm resize-none bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 disabled:text-gray-900"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {content.length}/{maxLength} characters
          </span>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-7 bg-transparent">
                Cancel
              </Button>
            )}
            <Button onClick={onSubmit} disabled={!content.trim() || isSubmitting} size="sm" className="text-xs h-7">
              {isSubmitting ? (
                <>
                  <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sticking...
                </>
              ) : (
                "Stick"
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <TextAreaField
        label=""
        placeholder="Write a reply... (max 1000 characters)"
        value={content}
        onChange={onContentChange}
        maxLength={maxLength}
        showCharCount={true}
        rows={3}
        className="text-sm text-gray-900"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">
          {content.length}/{maxLength}
        </span>
        <Button size="sm" onClick={onSubmit} disabled={!content.trim() || isSubmitting} className="h-8">
          {isSubmitting ? (
            <>
              <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Add Reply
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
