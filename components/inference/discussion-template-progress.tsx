"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Target,
  CheckCircle2,
  Circle,
  AlertCircle,
  X,
  Wrench,
  Scale,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  Settings,
  Flag,
} from "lucide-react"
import type { TemplateProgress, Milestone, MilestoneState, RequiredCategory } from "@/types/discussion-templates"

interface DiscussionTemplateProgressProps {
  progress: TemplateProgress
  templateCategory?: string
  onRemoveTemplate?: () => void
  className?: string
}

const categoryIcons: Record<string, React.ReactNode> = {
  "Problem Solving": <Wrench className="h-4 w-4" />,
  "Decision Making": <Scale className="h-4 w-4" />,
  "Feature Request": <Lightbulb className="h-4 w-4" />,
  "Incident Response": <AlertTriangle className="h-4 w-4" />,
  General: <MessageSquare className="h-4 w-4" />,
  Custom: <Settings className="h-4 w-4" />,
}

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  "Problem Solving": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  "Decision Making": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  "Feature Request": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  "Incident Response": { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  General: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" },
  Custom: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
}

export function DiscussionTemplateProgress({
  progress,
  templateCategory,
  onRemoveTemplate,
  className,
}: DiscussionTemplateProgressProps) {
  const colors = categoryColors[templateCategory || "Custom"] || categoryColors.Custom

  // All required categories (both fulfilled and missing)
  const allRequired: Array<{ category: string; fulfilled: boolean; required?: RequiredCategory }> = [
    ...progress.fulfilledCategories.map((cat) => ({ category: cat, fulfilled: true as const })),
    ...progress.missingCategories.map((req) => ({ category: req.category, fulfilled: false as const, required: req })),
  ]

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        colors.bg,
        colors.border,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md bg-white", colors.text)}>
            {categoryIcons[templateCategory || "Custom"] || categoryIcons.Custom}
          </div>
          <div>
            <h4 className={cn("font-semibold text-sm", colors.text)}>
              {progress.templateName}
            </h4>
            {progress.goalText && (
              <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                <Target className="h-3 w-3" />
                {progress.goalText}
              </p>
            )}
          </div>
        </div>
        {onRemoveTemplate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
            onClick={onRemoveTemplate}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-600">Completion Progress</span>
          <span className={cn("text-xs font-medium", colors.text)}>
            {progress.completionPercentage}%
          </span>
        </div>
        <Progress
          value={progress.completionPercentage}
          className="h-2"
        />
      </div>

      {/* Checklist */}
      <div className="mt-3 space-y-1.5">
        <TooltipProvider>
          <div className="flex flex-wrap gap-1.5">
            {allRequired.map((item, idx) => (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn(
                      "cursor-default text-xs transition-colors",
                      item.fulfilled
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "bg-white border-gray-300 text-gray-600"
                    )}
                  >
                    {item.fulfilled ? (
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                    ) : (
                      <Circle className="h-3 w-3 mr-1 text-gray-400" />
                    )}
                    {item.category}
                    {item.required && item.required.minCount > 1 && (
                      <span className="ml-1 text-gray-400">
                        ({item.required.minCount})
                      </span>
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {item.fulfilled
                    ? `${item.category} requirement fulfilled`
                    : item.required?.description || `Add a ${item.category} reply`}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {/* Milestones (if any reached) */}
      {progress.milestones.length > 0 && progress.milestones.some((m) => m.state.reached) && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-600 mb-1.5">
            <Flag className="h-3 w-3" />
            Milestones Reached
          </div>
          <div className="flex flex-wrap gap-1.5">
            {progress.milestones
              .filter((m) => m.state.reached)
              .map((milestone, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs bg-purple-50 border-purple-300 text-purple-700"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {milestone.name}
                </Badge>
              ))}
          </div>
        </div>
      )}

      {/* Resolution Warning */}
      {!progress.canResolve && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-2 rounded-md">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium">Cannot mark as Resolved yet</p>
              <ul className="mt-1 space-y-0.5">
                {progress.blockingReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
