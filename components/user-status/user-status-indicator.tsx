"use client"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { UserStatusType, EffectiveUserStatus } from "@/types/user-status"
import { STATUS_COLORS, STATUS_LABELS, formatTimeRemaining } from "@/types/user-status"
import { Circle, Clock, MinusCircle, BellOff, CircleDashed } from "lucide-react"

// ----------------------------------------------------------------------------
// Status Indicator Component
// ----------------------------------------------------------------------------
// Displays a colored dot indicating user status with optional tooltip

interface UserStatusIndicatorProps {
  readonly status: UserStatusType
  readonly customMessage?: string | null
  readonly focusModeEnabled?: boolean
  readonly focusModeExpiresAt?: string | null
  readonly showTooltip?: boolean
  readonly size?: "xs" | "sm" | "md" | "lg"
  readonly className?: string
  readonly pulseWhenOnline?: boolean
}

const sizeClasses = {
  xs: "w-2 h-2",
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-4 h-4",
}

const borderSizeClasses = {
  xs: "border",
  sm: "border",
  md: "border-2",
  lg: "border-2",
}

export function UserStatusIndicator({
  status,
  customMessage,
  focusModeEnabled,
  focusModeExpiresAt,
  showTooltip = true,
  size = "sm",
  className,
  pulseWhenOnline = false,
}: Readonly<UserStatusIndicatorProps>) {
  const statusColor = STATUS_COLORS[status]
  const statusLabel = STATUS_LABELS[status]

  const indicator = (
    <span
      className={cn(
        "inline-block rounded-full border-white",
        sizeClasses[size],
        borderSizeClasses[size],
        statusColor,
        pulseWhenOnline && status === "online" && "animate-pulse",
        className
      )}
      aria-label={statusLabel}
    />
  )

  if (!showTooltip) {
    return indicator
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusIcon status={status} className="h-3.5 w-3.5" />
              <span className="font-medium">{statusLabel}</span>
            </div>
            {customMessage && (
              <p className="text-sm text-muted-foreground">{customMessage}</p>
            )}
            {focusModeEnabled && focusModeExpiresAt && (
              <p className="text-xs text-red-600">
                Focus mode: {formatTimeRemaining(focusModeExpiresAt)} remaining
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ----------------------------------------------------------------------------
// Status Icon Component
// ----------------------------------------------------------------------------

interface StatusIconProps {
  readonly status: UserStatusType
  readonly className?: string
}

export function StatusIcon({ status, className }: Readonly<StatusIconProps>) {
  const iconClass = cn("text-current", className)

  switch (status) {
    case "online":
      return <Circle className={cn(iconClass, "fill-green-500 text-green-500")} />
    case "away":
      return <Clock className={cn(iconClass, "text-yellow-500")} />
    case "busy":
      return <MinusCircle className={cn(iconClass, "text-red-500")} />
    case "dnd":
      return <BellOff className={cn(iconClass, "text-red-600")} />
    case "offline":
      return <CircleDashed className={cn(iconClass, "text-gray-400")} />
    default:
      return <Circle className={cn(iconClass, "text-gray-400")} />
  }
}

// ----------------------------------------------------------------------------
// Status Badge Component
// ----------------------------------------------------------------------------
// Full badge with icon, label, and optional message

interface UserStatusBadgeProps {
  readonly status: UserStatusType
  readonly customMessage?: string | null
  readonly showLabel?: boolean
  readonly showMessage?: boolean
  readonly size?: "sm" | "md" | "lg"
  readonly className?: string
}

const badgeSizeClasses = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-1",
  lg: "text-base px-3 py-1.5",
}

const badgeIconSizes = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
}

export function UserStatusBadge({
  status,
  customMessage,
  showLabel = true,
  showMessage = true,
  size = "md",
  className,
}: Readonly<UserStatusBadgeProps>) {
  const statusLabel = STATUS_LABELS[status]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted",
        badgeSizeClasses[size],
        className
      )}
    >
      <StatusIcon status={status} className={badgeIconSizes[size]} />
      {showLabel && <span className="font-medium">{statusLabel}</span>}
      {showMessage && customMessage && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground truncate max-w-[150px]">
            {customMessage}
          </span>
        </>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Avatar with Status Component
// ----------------------------------------------------------------------------
// Wraps an avatar with a status indicator in the corner

interface AvatarWithStatusProps {
  readonly children: React.ReactNode
  readonly status: UserStatusType
  readonly statusSize?: "xs" | "sm" | "md"
  readonly position?: "bottom-right" | "top-right" | "bottom-left" | "top-left"
  readonly className?: string
}

const positionClasses = {
  "bottom-right": "bottom-0 right-0",
  "top-right": "top-0 right-0",
  "bottom-left": "bottom-0 left-0",
  "top-left": "top-0 left-0",
}

export function AvatarWithStatus({
  children,
  status,
  statusSize = "sm",
  position = "bottom-right",
  className,
}: Readonly<AvatarWithStatusProps>) {
  return (
    <div className={cn("relative inline-block", className)}>
      {children}
      <span
        className={cn(
          "absolute",
          positionClasses[position]
        )}
      >
        <UserStatusIndicator
          status={status}
          size={statusSize}
          showTooltip={false}
        />
      </span>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Status Indicator from EffectiveUserStatus
// ----------------------------------------------------------------------------
// Convenience component that takes an EffectiveUserStatus object

interface EffectiveStatusIndicatorProps {
  readonly userStatus: EffectiveUserStatus
  readonly showTooltip?: boolean
  readonly size?: "xs" | "sm" | "md" | "lg"
  readonly className?: string
}

export function EffectiveStatusIndicator({
  userStatus,
  showTooltip = true,
  size = "sm",
  className,
}: Readonly<EffectiveStatusIndicatorProps>) {
  return (
    <UserStatusIndicator
      status={userStatus.status}
      customMessage={userStatus.custom_message}
      focusModeEnabled={userStatus.focus_mode_enabled}
      showTooltip={showTooltip}
      size={size}
      className={className}
    />
  )
}
