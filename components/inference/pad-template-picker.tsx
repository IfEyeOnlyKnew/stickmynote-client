"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PadTemplate } from "@/types/pad-templates"
import { Briefcase, Book, Calendar, Zap, Users, Target, TrendingUp } from "lucide-react"
import { TemplatePickerBase } from "./template-picker-base"

interface PadTemplatePickerProps {
  readonly hubType?: "individual" | "organization"
  readonly onTemplateSelect: (template: PadTemplate) => void
}

const iconMap: Record<string, any> = {
  briefcase: Briefcase,
  book: Book,
  calendar: Calendar,
  zap: Zap,
  users: Users,
  target: Target,
}

export function PadTemplatePicker({ hubType, onTemplateSelect }: Readonly<PadTemplatePickerProps>) {
  const fetchTemplates = async () => {
    const params = new URLSearchParams()
    if (hubType) params.append("hub_type", hubType)
    const response = await fetch(`/api/pad-templates?${params}`)
    if (!response.ok) return { templates: [], categories: {} }
    const data = await response.json()
    return { templates: data.templates || [], categories: data.categories || {} }
  }

  const onUseTemplate = async (template: PadTemplate) => {
    await fetch(`/api/pad-templates/${template.id}/use`, { method: "POST" })
    onTemplateSelect(template)
  }

  const additionalFilter = (template: PadTemplate) =>
    !hubType || !template.hub_type || template.hub_type === hubType

  return (
    <TemplatePickerBase<PadTemplate>
      dialogTitle="Choose a Pad Template"
      dialogDescription="Start with a pre-configured workspace"
      searchPlaceholder="Search pad templates..."
      fetchTemplates={fetchTemplates}
      onUseTemplate={onUseTemplate}
      additionalFilter={additionalFilter}
      renderCard={(template, onSelect) => <PadTemplateCard key={template.id} template={template} onSelect={onSelect} />}
    />
  )
}

function PadTemplateCard({
  template,
  onSelect,
}: Readonly<{
  template: PadTemplate
  onSelect: (template: PadTemplate) => void
}>) {
  const Icon = template.icon_name ? iconMap[template.icon_name] : Briefcase

  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all duration-200 group"
      onClick={() => onSelect(template)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base group-hover:text-purple-600 transition-colors">{template.name}</CardTitle>
            {template.description && (
              <CardDescription className="text-xs mt-1 line-clamp-2">{template.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex gap-2">
            <Badge variant="outline">{template.category}</Badge>
            {template.hub_type && (
              <Badge variant="secondary" className="capitalize">
                {template.hub_type}
              </Badge>
            )}
          </div>
          {template.use_count > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {template.use_count}
            </span>
          )}
        </div>
        {template.initial_sticks && template.initial_sticks.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            Includes {template.initial_sticks.length} starter stick{template.initial_sticks.length > 1 ? "s" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
