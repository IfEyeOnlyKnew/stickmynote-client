"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
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
import { FileText, Search, Sparkles, TrendingUp } from "lucide-react"

interface TemplateBase {
  id: string
  name: string
  description?: string | null
  category: string
  use_count: number
}

interface TemplatePickerBaseProps<T extends TemplateBase> {
  readonly triggerLabel?: string
  readonly triggerSize?: "sm" | "default"
  readonly dialogTitle: string
  readonly dialogDescription: string
  readonly searchPlaceholder: string
  readonly popularCount?: number
  readonly showPopularInAllTab?: boolean
  readonly fetchTemplates: () => Promise<{ templates: T[]; categories: Record<string, number> }>
  readonly onUseTemplate: (template: T) => Promise<void> | void
  readonly additionalFilter?: (template: T) => boolean
  readonly renderCard: (template: T, onSelect: (t: T) => void) => ReactNode
  readonly sortCategories?: boolean
}

export function TemplatePickerBase<T extends TemplateBase>(props: Readonly<TemplatePickerBaseProps<T>>) {
  const {
    triggerLabel = "Use Template",
    triggerSize = "default",
    dialogTitle,
    dialogDescription,
    searchPlaceholder,
    popularCount = 4,
    showPopularInAllTab = false,
    fetchTemplates,
    onUseTemplate,
    additionalFilter,
    renderCard,
    sortCategories = false,
  } = props

  const [templates, setTemplates] = useState<T[]>([])
  const [categories, setCategories] = useState<Record<string, number>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [open, setOpen] = useState(false)
  // Loading flag is never read by the UI — the Dialog handles its own visual
  // pending state. Kept as a ref so we could add a spinner later without
  // triggering a re-render, and so S6754 doesn't flag a throwaway setter.
  const loadingRef = useRef(false)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!open) return
    loadingRef.current = true
    fetchTemplates()
      .then((data) => {
        setTemplates(data.templates || [])
        setCategories(data.categories || {})
      })
      .catch((err) => console.error("Error fetching templates:", err))
      .finally(() => {
        loadingRef.current = false
      })
  }, [open])
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleSelect = async (template: T) => {
    await onUseTemplate(template)
    setOpen(false)
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === "" ||
      template.name.toLowerCase().includes(q) ||
      (template.description?.toLowerCase().includes(q) ?? false)
    const matchesExtra = !additionalFilter || additionalFilter(template)
    return matchesCategory && matchesSearch && matchesExtra
  })

  const popularTemplates = [...(showPopularInAllTab ? templates : filteredTemplates)]
    .sort((a, b) => b.use_count - a.use_count)
    .slice(0, popularCount)

  const categoryEntries = sortCategories
    ? Object.entries(categories).sort(([, a], [, b]) => b - a)
    : Object.entries(categories)

  const renderPopular = () =>
    popularTemplates.length > 0 && (
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Popular Templates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {popularTemplates.map((t) => renderCard(t, handleSelect))}
        </div>
      </div>
    )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={triggerSize}
          className={triggerSize === "default" ? "gap-2 bg-transparent" : undefined}
        >
          <Sparkles className={triggerSize === "sm" ? "h-4 w-4 mr-2" : "h-4 w-4"} />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="all" value={selectedCategory} onValueChange={setSelectedCategory}>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
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
              {categoryEntries.map(([category, count]) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                  <Badge variant="secondary" className="ml-2">
                    {count}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="overflow-y-auto max-h-[50vh]">
              {!showPopularInAllTab && renderPopular()}

              <TabsContent value="all" className="mt-0">
                {showPopularInAllTab && renderPopular()}
                <h3 className="text-sm font-semibold mb-3">All Templates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTemplates.map((t) => renderCard(t, handleSelect))}
                </div>
              </TabsContent>

              {categoryEntries.map(([category]) => (
                <TabsContent key={category} value={category} className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTemplates
                      .filter((t) => t.category === category)
                      .map((t) => renderCard(t, handleSelect))}
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
