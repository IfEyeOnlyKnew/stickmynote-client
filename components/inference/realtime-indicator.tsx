"use client"

import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface RealtimeIndicatorProps {
  isConnected: boolean
}

export function RealtimeIndicator({ isConnected }: Readonly<RealtimeIndicatorProps>) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className={`flex items-center gap-1 ${
              isConnected ? "bg-green-500 hover:bg-green-600 text-white" : "bg-gray-300 hover:bg-gray-400 text-gray-700"
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                <span className="text-xs">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span className="text-xs">Offline</span>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isConnected ? "Real-time updates active" : "Reconnecting..."}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
