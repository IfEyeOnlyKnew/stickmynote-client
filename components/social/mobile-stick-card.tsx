"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, User, Calendar, Eye, ChevronDown, ChevronUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface MobileStickCardProps {
  stick: {
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
  }
  onView: () => void
  onToggle?: () => void
  isExpanded?: boolean
  replies?: Array<{
    id: string
    content: string
    color: string
    created_at: string
    users?: {
      full_name: string | null
      email: string
    } | null
  }>
}

export function MobileStickCard({ stick, onView, onToggle, isExpanded = false, replies = [] }: MobileStickCardProps) {
  return (
    <Card className="overflow-hidden touch-manipulation">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-6 rounded flex-shrink-0" style={{ backgroundColor: stick.color }} />
              <h3 className="font-semibold text-base truncate">{stick.topic}</h3>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{stick.content}</p>
          </div>
          <Button variant="ghost" size="sm" className="flex-shrink-0 h-8 w-8 p-0" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{stick.users?.full_name || stick.users?.email || "Unknown"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(stick.created_at), { addSuffix: true })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {stick.reply_count || 0} {stick.reply_count === 1 ? "reply" : "replies"}
          </Badge>
          {onToggle && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onToggle}>
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show
                </>
              )}
            </Button>
          )}
        </div>

        {isExpanded && replies.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3">
            {replies.map((reply) => (
              <Card
                key={reply.id}
                className="p-3 bg-gray-50"
                style={{ borderLeftWidth: "3px", borderLeftColor: reply.color }}
              >
                <p className="text-sm mb-2">{reply.content}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">{reply.users?.full_name || reply.users?.email || "Unknown"}</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
