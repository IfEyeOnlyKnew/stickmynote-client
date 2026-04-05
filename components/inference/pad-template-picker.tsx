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
import type { PadTemplate } from "@/types/pad-templates"
import { Sparkles, Search, TrendingUp, Briefcase, Book, Calendar, Zap, Users, Target } from "lucide-react"

interface PadTemplatePickerProps {
  hubType?: "individual" | "organization"
  onTemplateSelect: (template: PadTemplate) => void
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
  const [templates, setTemplates] = useState<PadTemplate[]>([])
  const [categories, setCategories] = useState<Record<string, number>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [, setLoading] = useState(false)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open, hubType])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (hubType) params.append("hub_type", hubType)

      const response = await fetch(`/api/pad-templates?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
        setCategories(data.categories || {})
      }
    } catch (error) {
      console.error("Error fetching pad templates:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = async (template: PadTemplate) => {
    // Increment use count
    await fetch(`/api/pad-templates/${template.id}/use`, { method: "POST" })

    onTemplateSelect(template)
    setOpen(false)
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesHubType = !hubType || !template.hub_type || template.hub_type === hubType
    return matchesCategory && matchesSearch && matchesHubType
  })

  const popularTemplates = [...filteredTemplates].sort((a, b) => b.use_count - a.use_count).slice(0, 4)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Sparkles className="h-4 w-4" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose a Pad Template</DialogTitle>
          <DialogDescription>Start with a pre-configured workspace</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="all" value={selectedCategory} onValueChange={setSelectedCategory}>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pad templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
              <TabsTrigger value="all">
                All Templates
                <Badge variant="secondary" className="ml-2">
                  {templates.length}
                </Badge>
              </TabsTrigger>
              {Object.entries(categories).map(([category, count]) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                  <Badge variant="secondary" className="ml-2">
                    {count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="overflow-y-auto max-h-[50vh]">
              {popularTemplates.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Popular Templates
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {popularTemplates.map((template) => (
                      <PadTemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                    ))}
                  </div>
                </div>
              )}

              <TabsContent value="all" className="mt-0">
                <h3 className="text-sm font-semibold mb-3">All Templates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTemplates.map((template) => (
                    <PadTemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                  ))}
                </div>
              </TabsContent>

              {Object.keys(categories).map((category) => (
                <TabsContent key={category} value={category} className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTemplates
                      .filter((t) => t.category === category)
                      .map((template) => (
                        <PadTemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                      ))}
                  </div>
                </TabsContent>
              ))}

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
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
