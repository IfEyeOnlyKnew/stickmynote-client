"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import type { StickTemplate } from "@/types/templates"
import { FileText, Search, Sparkles, TrendingUp } from "lucide-react"

interface TemplatePickerProps {
  onTemplateSelect: (template: StickTemplate) => void
}

export function TemplatePicker({ onTemplateSelect }: Readonly<TemplatePickerProps>) {
  const [templates, setTemplates] = useState<StickTemplate[]>([])
  const [categories, setCategories] = useState<Record<string, number>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/stick-templates")
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
        setCategories(data.categories || {})
      }
    } catch (error) {
      console.error("Error fetching templates:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = async (template: StickTemplate) => {
    // Increment use count
    await fetch(`/api/stick-templates/${template.id}/use`, { method: "POST" })

    onTemplateSelect(template)
    setOpen(false)
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const sortedCategories = Object.entries(categories).sort(([, a], [, b]) => b - a)
  const popularTemplates = [...templates].sort((a, b) => b.use_count - a.use_count).slice(0, 6)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
          <DialogDescription>Start with a pre-built template to save time</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="all" value={selectedCategory} onValueChange={setSelectedCategory}>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all">
                All Templates
                <Badge variant="secondary" className="ml-2">
                  {templates.length}
                </Badge>
              </TabsTrigger>
              {sortedCategories.map(([category, count]) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                  <Badge variant="secondary" className="ml-2">
                    {count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="overflow-y-auto max-h-[50vh]">
              <TabsContent value="all" className="mt-0">
                {popularTemplates.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Popular Templates
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {popularTemplates.map((template) => (
                        <TemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="text-sm font-semibold mb-3">All Templates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTemplates.map((template) => (
                    <TemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                  ))}
                </div>
              </TabsContent>

              {sortedCategories.map(([category]) => (
                <TabsContent key={category} value={category} className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTemplates
                      .filter((t) => t.category === category)
                      .map((template) => (
                        <TemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                      ))}
                  </div>
                </TabsContent>
              ))}

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No templates found</p>
                </div>
              )}
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
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
