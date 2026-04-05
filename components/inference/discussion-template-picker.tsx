"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Wrench,
  Scale,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  Settings,
  Check,
  Target,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import type { DiscussionTemplate } from "@/types/discussion-templates"

interface DiscussionTemplatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (template: DiscussionTemplate) => Promise<void>
  currentTemplateId?: string
}

const categoryIcons: Record<string, React.ReactNode> = {
  "Problem Solving": <Wrench className="h-5 w-5" />,
  "Decision Making": <Scale className="h-5 w-5" />,
  "Feature Request": <Lightbulb className="h-5 w-5" />,
  "Incident Response": <AlertTriangle className="h-5 w-5" />,
  General: <MessageSquare className="h-5 w-5" />,
  Custom: <Settings className="h-5 w-5" />,
}

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  "Problem Solving": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  "Decision Making": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  "Feature Request": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  "Incident Response": { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  General: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" },
  Custom: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
}

export function DiscussionTemplatePicker({
  open,
  onOpenChange,
  onSelect,
  currentTemplateId,
}: Readonly<DiscussionTemplatePickerProps>) {
  const [templates, setTemplates] = useState<DiscussionTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/v2/discussion-templates")
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error("Error fetching templates:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (template: DiscussionTemplate) => {
    setSelecting(template.id)
    try {
      await onSelect(template)
      onOpenChange(false)
    } catch (error) {
      console.error("Error selecting template:", error)
    } finally {
      setSelecting(null)
    }
  }

  // Get unique categories from templates
  const categories = Array.from(new Set(templates.map((t) => t.category)))

  // Filter templates by category
  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose a Discussion Template</DialogTitle>
          <DialogDescription>
            Select a template to guide the conversation flow and track progress toward resolution
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.map((category) => {
                const colors = categoryColors[category] || categoryColors.Custom
                return (
                  <Button
                    key={category}
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      selectedCategory === category && colors.bg,
                      selectedCategory === category && colors.border,
                      selectedCategory === category && colors.text
                    )}
                  >
                    {categoryIcons[category] || categoryIcons.Custom}
                    <span className="ml-1">{category}</span>
                  </Button>
                )
              })}
            </div>

            {/* Template List */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No templates found
                  </div>
                ) : (
                  filteredTemplates.map((template) => {
                    const colors = categoryColors[template.category] || categoryColors.Custom
                    const isSelected = template.id === currentTemplateId
                    const isSelecting = selecting === template.id

                    return (
                      <div
                        key={template.id}
                        tabIndex={0}
                        className={cn(
                          "p-4 rounded-lg border-2 cursor-pointer transition-all",
                          "hover:shadow-md",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => !isSelecting && handleSelect(template)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { if (!isSelecting) handleSelect(template) } }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-lg",
                                colors.bg,
                                colors.text
                              )}
                            >
                              {categoryIcons[template.category] || categoryIcons.Custom}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">
                                  {template.name}
                                </h3>
                                {template.is_system && (
                                  <Badge variant="secondary" className="text-xs">
                                    System
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Badge variant="default" className="text-xs">
                                    <Check className="h-3 w-3 mr-1" />
                                    Current
                                  </Badge>
                                )}
                              </div>
                              {template.goal_text && (
                                <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                                  <Target className="h-3 w-3 flex-shrink-0" />
                                  {template.goal_text}
                                </p>
                              )}
                              {template.description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {template.description}
                                </p>
                              )}

                              {/* Required Categories Preview */}
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {template.required_categories.map((req) => (
                                  <Badge
                                    key={req.category}
                                    variant="outline"
                                    className="text-xs bg-white"
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1 text-gray-400" />
                                    {req.category}
                                    {req.minCount > 1 && ` (${req.minCount})`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant={isSelected ? "outline" : "default"}
                            disabled={isSelecting}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelect(template)
                            }}
                          >
                            {isSelecting && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {!isSelecting && isSelected && "Reapply"}
                            {!isSelecting && !isSelected && "Apply"}
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
