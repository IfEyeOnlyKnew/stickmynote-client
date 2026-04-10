"use client"

import type React from "react"

import { Calendar, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface CalStickControlsProps {
  readonly replyId: string
  readonly context: string
  readonly isCalStick: boolean
  readonly calStickDate: string | null
  readonly calStickCompleted: boolean
  readonly isEditing: boolean
  readonly editingDate: string
  readonly onToggle: (replyId: string, currentIsCalStick: boolean, currentDate: string | null) => void
  readonly onDateChange: (date: string) => void
  readonly onSave: (replyId: string) => void
  readonly onCancel: () => void
  readonly onToggleComplete: (replyId: string, currentCompleted: boolean) => void
}

export const CalStickControls: React.FC<CalStickControlsProps> = ({
  replyId,
  context,
  isCalStick,
  calStickDate,
  calStickCompleted,
  isEditing,
  editingDate,
  onToggle,
  onDateChange,
  onSave,
  onCancel,
  onToggleComplete,
}) => {
  return (
    <div className="flex items-center gap-3 pt-2 border-t">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`calstick-${context}-${replyId}`}
          checked={isCalStick}
          onChange={() => onToggle(replyId, isCalStick, calStickDate)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <Label
          htmlFor={`calstick-${context}-${replyId}`}
          className="text-sm font-medium flex items-center gap-1 cursor-pointer"
        >
          <Calendar className="h-3 w-3" />
          CalStick
        </Label>
      </div>

      {isCalStick && calStickDate && !isEditing && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Due: {new Date(calStickDate).toLocaleDateString()}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleComplete(replyId, calStickCompleted)}
            className={`h-6 px-2 text-xs ${
              calStickCompleted ? "bg-green-100 text-green-700 hover:bg-green-200" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Check className="h-3 w-3 mr-1" />
            {calStickCompleted ? "Completed" : "Mark Complete"}
          </Button>
        </div>
      )}

      {isEditing && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            id={`calstick-date-${context}-${replyId}`}
            value={editingDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="text-xs h-7 w-36"
            min={new Date().toISOString().split("T")[0]}
            aria-label="Select due date for CalStick task"
            placeholder="Select date"
          />
          <Button variant="default" size="sm" onClick={() => onSave(replyId)} className="h-7 px-2 text-xs">
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 px-2 text-xs">
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
