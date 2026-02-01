"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useUserStatus } from "@/hooks/useUserStatus"
import { StatusIcon, UserStatusIndicator } from "./user-status-indicator"
import type { UserStatusType } from "@/types/user-status"
import {
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  STATUS_DURATION_PRESETS,
  FOCUS_MODE_PRESETS,
} from "@/types/user-status"
import {
  BellOff,
  ChevronDown,
  Loader2,
  Pencil,
  X,
} from "lucide-react"

// ----------------------------------------------------------------------------
// Status Selector Popover
// ----------------------------------------------------------------------------
// Quick status selector that appears as a dropdown

interface UserStatusSelectorProps {
  readonly className?: string
  readonly showCurrentStatus?: boolean
}

export function UserStatusSelector({
  className,
  showCurrentStatus = true,
}: UserStatusSelectorProps) {
  const {
    effective,
    loading,
    updating,
    setOnline,
    setAway,
    setBusy,
    setDND,
    enableFocusMode,
    disableFocusMode,
    clearCustomMessage,
  } = useUserStatus()

  const [isOpen, setIsOpen] = useState(false)
  const [showCustomMessageDialog, setShowCustomMessageDialog] = useState(false)

  const handleStatusChange = async (newStatus: UserStatusType) => {
    switch (newStatus) {
      case "online":
        await setOnline()
        break
      case "away":
        await setAway()
        break
      case "busy":
        await setBusy()
        break
      case "dnd":
        await setDND()
        break
    }
    setIsOpen(false)
  }

  const handleFocusModeToggle = async () => {
    if (effective?.focus_mode_enabled) {
      await disableFocusMode()
    } else {
      await enableFocusMode(60) // Default: 1 hour
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentStatus = effective?.status || "online"

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-2 h-8", className)}
            disabled={updating}
          >
            <UserStatusIndicator
              status={currentStatus}
              size="sm"
              showTooltip={false}
            />
            {showCurrentStatus && (
              <>
                <span className="text-sm">{STATUS_LABELS[currentStatus]}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-3 border-b">
            <p className="text-sm font-medium">Set your status</p>
          </div>

          {/* Status Options */}
          <div className="p-1">
            <StatusOption
              status="online"
              isActive={currentStatus === "online" && !(effective?.focus_mode_enabled ?? false)}
              onClick={() => handleStatusChange("online")}
            />
            <StatusOption
              status="away"
              isActive={currentStatus === "away"}
              onClick={() => handleStatusChange("away")}
            />
            <StatusOption
              status="busy"
              isActive={currentStatus === "busy"}
              onClick={() => handleStatusChange("busy")}
            />
            <StatusOption
              status="dnd"
              isActive={currentStatus === "dnd" || (effective?.focus_mode_enabled ?? false)}
              onClick={() => handleStatusChange("dnd")}
            />
          </div>

          <Separator />

          {/* Custom Message */}
          <div className="p-2">
            {effective?.custom_message ? (
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-muted">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{effective.custom_message}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowCustomMessageDialog(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => clearCustomMessage()}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setShowCustomMessageDialog(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Set a custom message
              </Button>
            )}
          </div>

          <Separator />

          {/* Focus Mode Toggle */}
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellOff className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Focus Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Mute all notifications
                  </p>
                </div>
              </div>
              <Switch
                checked={effective?.focus_mode_enabled ?? false}
                onCheckedChange={handleFocusModeToggle}
                disabled={updating}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Custom Message Dialog */}
      <CustomMessageDialog
        open={showCustomMessageDialog}
        onOpenChange={setShowCustomMessageDialog}
        currentMessage={effective?.custom_message}
      />
    </>
  )
}

// ----------------------------------------------------------------------------
// Status Option Component
// ----------------------------------------------------------------------------

interface StatusOptionProps {
  readonly status: UserStatusType
  readonly isActive: boolean
  readonly onClick: () => void
}

function StatusOption({ status, isActive, onClick }: StatusOptionProps) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted text-foreground"
      )}
      onClick={onClick}
    >
      <StatusIcon status={status} className="h-4 w-4" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{STATUS_LABELS[status]}</p>
        <p className="text-xs text-muted-foreground truncate">
          {STATUS_DESCRIPTIONS[status]}
        </p>
      </div>
      {isActive && (
        <span className="h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  )
}

// ----------------------------------------------------------------------------
// Custom Message Dialog
// ----------------------------------------------------------------------------

interface CustomMessageDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly currentMessage?: string | null
}

function CustomMessageDialog({
  open,
  onOpenChange,
  currentMessage,
}: CustomMessageDialogProps) {
  const { setCustomMessage, clearCustomMessage, updating } = useUserStatus()
  const [message, setMessage] = useState(currentMessage || "")
  const [duration, setDuration] = useState("0") // 0 = don't clear

  const handleSave = async () => {
    if (message.trim()) {
      await setCustomMessage(message.trim(), Number.parseInt(duration, 10))
    } else {
      await clearCustomMessage()
    }
    onOpenChange(false)
  }

  const handleClear = async () => {
    await clearCustomMessage()
    setMessage("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set a status message</DialogTitle>
          <DialogDescription>
            Let others know what you&apos;re up to
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Input
              id="message"
              placeholder="What's your status?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/100
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Clear after</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_DURATION_PRESETS.map((preset) => (
                  <SelectItem key={preset.minutes} value={String(preset.minutes)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {currentMessage && (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={updating}
              className="mr-auto"
            >
              Clear status
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updating}>
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Focus Mode Quick Toggle
// ----------------------------------------------------------------------------
// Standalone button for quickly toggling focus mode

interface FocusModeToggleProps {
  readonly className?: string
}

export function FocusModeToggle({ className }: FocusModeToggleProps) {
  const { effective, enableFocusMode, disableFocusMode, updating } = useUserStatus()
  const [showDurationPicker, setShowDurationPicker] = useState(false)

  const isEnabled = effective?.focus_mode_enabled ?? false

  const handleToggle = async () => {
    if (isEnabled) {
      await disableFocusMode()
    } else {
      setShowDurationPicker(true)
    }
  }

  const handleEnable = async (minutes: number) => {
    await enableFocusMode(minutes || undefined)
    setShowDurationPicker(false)
  }

  return (
    <>
      <Button
        variant={isEnabled ? "destructive" : "outline"}
        size="sm"
        className={cn("gap-2", className)}
        onClick={handleToggle}
        disabled={updating}
      >
        <BellOff className="h-4 w-4" />
        {isEnabled ? "End Focus Mode" : "Focus Mode"}
      </Button>

      <Dialog open={showDurationPicker} onOpenChange={setShowDurationPicker}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enable Focus Mode</DialogTitle>
            <DialogDescription>
              All notifications will be muted. Choose how long:
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            {FOCUS_MODE_PRESETS.map((preset) => (
              <Button
                key={preset.minutes}
                variant="outline"
                className="justify-start"
                onClick={() => handleEnable(preset.minutes)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDurationPicker(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
