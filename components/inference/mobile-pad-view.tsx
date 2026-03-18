"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Globe, Lock, Settings, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { MobileStickCard } from "./mobile-stick-card"
import { useRouter } from "next/navigation"

interface MobilePadViewProps {
  pad: {
    id: string
    name: string
    description: string | null
    is_public: boolean
    hub_type: "individual" | "organization" | null
    created_at: string
  }
  sticks: Array<{
    id: string
    topic: string
    content: string
    color: string
    created_at: string
    users?: {
      full_name: string | null
      email: string
    } | null
    reply_count?: number
  }>
  onStickView: (stickId: string) => void
  onStickToggle?: (stickId: string) => void
  expandedSticks?: Set<string>
  replies?: Record<string, any[]>
}

export function MobilePadView({
  pad,
  sticks,
  onStickView,
  onStickToggle,
  expandedSticks = new Set(),
  replies = {},
}: MobilePadViewProps) {
  const router = useRouter()

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 truncate">{pad.name}</h2>
                {pad.hub_type && (
                  <Badge variant="secondary" className="capitalize text-xs">
                    {pad.hub_type}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  {pad.is_public ? (
                    <>
                      <Globe className="h-3 w-3 text-green-600" />
                      Public
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3 text-orange-600" />
                      Private
                    </>
                  )}
                </Badge>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(pad.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 h-8 w-8 p-0"
              onClick={() => router.push(`/inference/pads/${pad.id}`)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          {pad.description && <p className="text-sm text-gray-600 line-clamp-2">{pad.description}</p>}
        </CardContent>
      </Card>

      {sticks.length > 0 ? (
        <div className="space-y-3">
          {sticks.map((stick) => (
            <MobileStickCard
              key={stick.id}
              stick={stick}
              onView={() => onStickView(stick.id)}
              onToggle={onStickToggle ? () => onStickToggle(stick.id) : undefined}
              isExpanded={expandedSticks.has(stick.id)}
              replies={replies[stick.id]}
            />
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">No sticks in this pad yet</p>
        </Card>
      )}
    </div>
  )
}
