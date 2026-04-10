"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"
import type { StickTemplate } from "@/types/templates"
import { TemplatePickerBase } from "./template-picker-base"

interface TemplatePickerProps {
  readonly onTemplateSelect: (template: StickTemplate) => void
}

export function TemplatePicker({ onTemplateSelect }: Readonly<TemplatePickerProps>) {
  const fetchTemplates = async () => {
    const response = await fetch("/api/stick-templates")
    if (!response.ok) return { templates: [], categories: {} }
    const data = await response.json()
    return { templates: data.templates || [], categories: data.categories || {} }
  }

  const onUseTemplate = async (template: StickTemplate) => {
    await fetch(`/api/stick-templates/${template.id}/use`, { method: "POST" })
    onTemplateSelect(template)
  }

  return (
    <TemplatePickerBase<StickTemplate>
      triggerSize="sm"
      dialogTitle="Choose a Template"
      dialogDescription="Start with a pre-built template to save time"
      searchPlaceholder="Search templates..."
      popularCount={6}
      showPopularInAllTab={true}
      sortCategories={true}
      fetchTemplates={fetchTemplates}
      onUseTemplate={onUseTemplate}
      renderCard={(template, onSelect) => <TemplateCard key={template.id} template={template} onSelect={onSelect} />}
    />
  )
}

function TemplateCard({
  template,
  onSelect,
}: Readonly<{
  template: StickTemplate
  onSelect: (template: StickTemplate) => void
}>) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:border-purple-300 transition-all duration-200 group"
      onClick={() => onSelect(template)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base group-hover:text-purple-600 transition-colors">{template.name}</CardTitle>
            {template.description && <CardDescription className="text-xs mt-1">{template.description}</CardDescription>}
          </div>
          {template.is_system && (
            <Badge variant="secondary" className="text-xs">
              System
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Badge variant="outline">{template.category}</Badge>
          {template.use_count > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {template.use_count} uses
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
