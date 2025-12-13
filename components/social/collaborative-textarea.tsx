"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { usePresence } from "@/hooks/use-presence"
import { cn } from "@/lib/utils"

interface CollaborativeTextareaProps {
  roomId: string
  elementId: string
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
  disabled?: boolean
}

export function CollaborativeTextarea({
  roomId,
  elementId,
  value,
  onChange,
  label,
  placeholder,
  rows = 4,
  maxLength,
  className,
  disabled = false,
}: CollaborativeTextareaProps) {
  const { presenceUsers, isConnected } = usePresence({ stickId: roomId })
  const [isFocused, setIsFocused] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  const activeUsers = presenceUsers.filter((user) => isConnected)
  const typingUsers = isTyping && isFocused ? [{ userName: "Someone", userId: "typing" }] : []

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
    setIsTyping(false)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)

    // Set typing indicator
    setIsTyping(true)

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Clear typing indicator after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
    }, 2000)
  }

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2">
              {typingUsers.map((user) => (
                <Badge key={user.userId} variant="secondary" className="text-xs">
                  {user.userName} is typing...
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="relative">
        <Textarea
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          className={cn(className, isFocused && activeUsers.length > 0 && "ring-2 ring-primary")}
        />
        {maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {value.length}/{maxLength}
          </div>
        )}
      </div>
      {activeUsers.length > 0 && !isFocused && (
        <div className="flex flex-wrap gap-1">
          {activeUsers.map((user) => (
            <Badge key={user.userId} variant="outline" className="text-xs">
              {user.userName} is viewing
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
