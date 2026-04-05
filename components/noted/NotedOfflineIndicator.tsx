"use client"

import { Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NotedOfflineIndicatorProps {
  isOnline: boolean
  syncPending: number
  syncing: boolean
  onSync: () => void
}

export function NotedOfflineIndicator({
  isOnline,
  syncPending,
  syncing,
  onSync,
}: Readonly<NotedOfflineIndicatorProps>) {
  if (isOnline && syncPending === 0) return null

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        {!isOnline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="text-[10px] gap-1 h-5">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>You are working offline. Changes will sync when reconnected.</p>
            </TooltipContent>
          </Tooltip>
        )}

        {syncPending > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-5 text-[10px] gap-1 px-1.5"
                onClick={onSync}
                disabled={!isOnline || syncing}
              >
                {syncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {syncPending} pending
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {(() => {
                  if (syncing) return "Syncing changes..."
                  if (isOnline) return "Click to sync pending changes"
                  return "Changes will sync when back online"
                })()}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {isOnline && syncPending === 0 && (
          <Badge variant="outline" className="text-[10px] gap-1 h-5 text-green-600">
            <Wifi className="h-3 w-3" />
            Synced
          </Badge>
        )}
      </div>
    </TooltipProvider>
  )
}
