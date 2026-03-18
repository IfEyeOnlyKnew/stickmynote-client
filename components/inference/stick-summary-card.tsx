"use client"

import { useState, memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  History,
  AlertCircle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ActionItem {
  title: string
  owner: string
  status: string
  due_hint?: string
}

interface StickSummaryCardProps {
  summary?: string
  actionItems?: ActionItem[]
  suggestedQuestions?: string[]
  lastSummarizedAt?: string
  replyCount?: number
  summaryReplyCount?: number
  onRegenerateSummary?: () => void
  onInsertQuestion?: (question: string) => void
  onViewHistory?: () => void
  isLoading?: boolean
  showGenerateButton?: boolean
}

export const StickSummaryCard = memo(function StickSummaryCard({
  summary,
  actionItems = [],
  suggestedQuestions = [],
  lastSummarizedAt,
  replyCount = 0,
  summaryReplyCount = 0,
  onRegenerateSummary,
  onInsertQuestion,
  onViewHistory,
  isLoading = false,
  showGenerateButton = false,
}: StickSummaryCardProps) {
  const [expanded, setExpanded] = useState(true)

  const isStale = summaryReplyCount !== undefined && replyCount > summaryReplyCount
  const newRepliesCount = isStale ? replyCount - summaryReplyCount : 0

  if (!summary && !actionItems.length && !suggestedQuestions.length) {
    if (showGenerateButton && onRegenerateSummary) {
      return (
        <Card className="border-dashed border-blue-200 bg-blue-50/30 min-h-[140px]">
          <CardContent className="py-6 text-center">
            <Sparkles className="h-8 w-8 text-blue-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-3">
              Generate an AI summary to track action items and suggested questions
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerateSummary}
              disabled={isLoading}
              className="border-blue-300 text-blue-700 hover:bg-blue-100 bg-transparent min-w-[160px]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Summary
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )
    }
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "in-progress":
        return <Clock className="h-4 w-4 text-blue-600" />
      default:
        return <Circle className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <Card className={`border-blue-200 ${isStale ? "bg-amber-50/50" : "bg-blue-50/50"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            AI Thread Brief
            {lastSummarizedAt && (
              <span className="text-xs text-gray-500 font-normal">
                Updated {formatDistanceToNow(new Date(lastSummarizedAt), { addSuffix: true })}
              </span>
            )}
            {isStale && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300 bg-amber-100">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {newRepliesCount} new {newRepliesCount === 1 ? "reply" : "replies"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Summary may be outdated. Click Refresh to update.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {onViewHistory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewHistory}
                className="h-8 w-8 p-0"
                title="View summary history"
              >
                <History className="h-4 w-4" />
              </Button>
            )}
            {onRegenerateSummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerateSummary}
                disabled={isLoading}
                className={`h-8 text-xs ${isStale ? "text-amber-700 hover:bg-amber-100" : ""}`}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
                {isStale ? "Update" : "Refresh"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="h-8 w-8 p-0">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Summary */}
          {summary && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Current Status</h4>
              <p className="text-sm text-gray-900">{summary}</p>
            </div>
          )}

          {/* Action Items */}
          {actionItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Action Items ({actionItems.length})</h4>
              <div className="space-y-2">
                {actionItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    {getStatusIcon(item.status)}
                    <div className="flex-1">
                      <p className="text-gray-900">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                        <span className="font-medium">{item.owner}</span>
                        {item.due_hint && (
                          <>
                            <span>-</span>
                            <span>{item.due_hint}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Questions */}
          {suggestedQuestions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Next Questions</h4>
              <div className="space-y-2">
                {suggestedQuestions.map((question, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <p className="text-sm text-gray-700 flex-1">{question}</p>
                    {onInsertQuestion && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onInsertQuestion(question)}
                        className="h-7 text-xs"
                      >
                        Ask
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
})
