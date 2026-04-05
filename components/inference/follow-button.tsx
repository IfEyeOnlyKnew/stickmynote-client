"use client"

import { useState } from "react"
import {
  Bell,
  BellOff,
  BellRing,
  ChevronDown,
  Mail,
  Globe,
  MessageSquare,
  RefreshCw,
  AtSign,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFollow } from "@/hooks/use-follow"
import { cn } from "@/lib/utils"

interface FollowButtonProps {
  entityType: "stick" | "pad" | "social_stick" | "social_pad"
  entityId: string
  entityName?: string
  variant?: "default" | "compact" | "icon"
  className?: string
}

export function FollowButton({ entityType, entityId, entityName, variant = "default", className }: Readonly<FollowButtonProps>) {
  const { isFollowing, subscription, isLoading, follow, unfollow, updateChannels } = useFollow({
    entityType,
    entityId,
  })
  const [isOpen, setIsOpen] = useState(false)

  const handleToggleFollow = async () => {
    if (isFollowing) {
      await unfollow()
    } else {
      await follow()
    }
  }

  const handleChannelToggle = async (channel: "inApp" | "email" | "webhook") => {
    if (!subscription) return

    const newChannels = {
      inApp: subscription.channel_in_app,
      email: subscription.channel_email,
      webhook: subscription.channel_webhook,
    }
    newChannels[channel] = !newChannels[channel]

    await updateChannels(newChannels)
  }

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggleFollow}
        disabled={isLoading}
        className={cn(isFollowing && "text-primary", className)}
        title={isFollowing ? "Unfollow" : "Follow"}
      >
        {isFollowing ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </Button>
    )
  }

  if (variant === "compact") {
    return (
      <Button
        variant={isFollowing ? "secondary" : "outline"}
        size="sm"
        onClick={handleToggleFollow}
        disabled={isLoading}
        className={cn("gap-1.5", className)}
      >
        {isFollowing ? (
          <>
            <BellRing className="h-3.5 w-3.5" />
            Following
          </>
        ) : (
          <>
            <Bell className="h-3.5 w-3.5" />
            Follow
          </>
        )}
      </Button>
    )
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant={isFollowing ? "secondary" : "outline"}
        size="sm"
        onClick={handleToggleFollow}
        disabled={isLoading}
        className="gap-1.5 rounded-r-none"
      >
        {isFollowing ? (
          <>
            <BellRing className="h-3.5 w-3.5" />
            Following
          </>
        ) : (
          <>
            <Bell className="h-3.5 w-3.5" />
            Follow
          </>
        )}
      </Button>

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={isFollowing ? "secondary" : "outline"}
            size="sm"
            className="px-2 rounded-l-none border-l-0"
            disabled={isLoading}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{entityName ? `Follow "${entityName}"` : "Follow Settings"}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isFollowing ? (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Notification Channels
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={subscription?.channel_in_app ?? true}
                onCheckedChange={() => handleChannelToggle("inApp")}
              >
                <Bell className="h-4 w-4 mr-2" />
                In-app notifications
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={subscription?.channel_email ?? false}
                onCheckedChange={() => handleChannelToggle("email")}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email notifications
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={subscription?.channel_webhook ?? false}
                onCheckedChange={() => handleChannelToggle("webhook")}
              >
                <Globe className="h-4 w-4 mr-2" />
                Webhook
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />

              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Notify me about
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={subscription?.notify_replies ?? true} disabled>
                <MessageSquare className="h-4 w-4 mr-2" />
                New replies
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={subscription?.notify_updates ?? true} disabled>
                <RefreshCw className="h-4 w-4 mr-2" />
                Content updates
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={subscription?.notify_mentions ?? true} disabled>
                <AtSign className="h-4 w-4 mr-2" />
                Mentions
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={subscription?.notify_status_changes ?? true} disabled>
                <Activity className="h-4 w-4 mr-2" />
                Status changes
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={unfollow} className="text-destructive focus:text-destructive">
                <BellOff className="h-4 w-4 mr-2" />
                Unfollow
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => follow()}>
                <Bell className="h-4 w-4 mr-2" />
                Follow (in-app only)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => follow({ inApp: true, email: true })}>
                <Mail className="h-4 w-4 mr-2" />
                Follow + Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => follow({ inApp: true, email: true, webhook: true })}>
                <Globe className="h-4 w-4 mr-2" />
                Follow all channels
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
