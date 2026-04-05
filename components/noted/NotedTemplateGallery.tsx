"use client"

import { useEffect, useState, useCallback } from "react"
import { FileText, Plus, Pencil, Trash2, Copy, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useNotedTemplates, type NotedTemplate } from "@/hooks/useNotedTemplates"
import { NotedTemplateEditor } from "./NotedTemplateEditor"

const CATEGORY_TABS = [
  { value: "", label: "All" },
  { value: "meetings", label: "Meetings" },
  { value: "projects", label: "Projects" },
  { value: "planning", label: "Planning" },
  { value: "general", label: "General" },
  { value: "my", label: "My Templates" },
]

const CATEGORY_COLORS: Record<string, string> = {
  meetings: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  projects: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  planning: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  general: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
}

interface NotedTemplateGalleryProps {
  open: boolean
  onClose: () => void
  onUseTemplate: (template: { title: string; content: string }) => void
}

export function NotedTemplateGallery({
  open,
  onClose,
  onUseTemplate,
}: Readonly<NotedTemplateGalleryProps>) {
  const { templates, loading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate } = useNotedTemplates()
  const [activeCategory, setActiveCategory] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [previewTemplate, setPreviewTemplate] = useState<NotedTemplate | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NotedTemplate | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchTemplates()
      setSearchQuery("")
      setActiveCategory("")
      setPreviewTemplate(null)
    }
  }, [open, fetchTemplates])

  const filteredTemplates = templates.filter((t) => {
    if (activeCategory === "my") return !t.is_system
    if (activeCategory && t.category !== activeCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    }
    return true
  })

  const handleUseTemplate = useCallback(
    (template: NotedTemplate) => {
      onUseTemplate({ title: template.name, content: template.content })
      onClose()
    },
    [onUseTemplate, onClose]
  )

  const handleCreateBlank = useCallback(() => {
    onUseTemplate({ title: "", content: "" })
    onClose()
  }, [onUseTemplate, onClose])

  const handleSaveTemplate = useCallback(
    async (data: { name: string; description: string; category: string; content: string }) => {
      if (editingTemplate && !editingTemplate.is_system) {
        await updateTemplate(editingTemplate.id, data)
      } else {
        // Creating new or customizing a system template
        await createTemplate(data)
      }
      setEditingTemplate(null)
    },
    [editingTemplate, createTemplate, updateTemplate]
  )

  const handleCustomize = useCallback((template: NotedTemplate) => {
    setEditingTemplate(template)
    setEditorOpen(true)
  }, [])

  const handleEdit = useCallback((template: NotedTemplate) => {
    setEditingTemplate(template)
    setEditorOpen(true)
  }, [])

  const handleCreateNew = useCallback(() => {
    setEditingTemplate(null)
    setEditorOpen(true)
  }, [])

  const stripHtml = (html: string) => {
    if (!html) return ""
    return html.replaceAll(/<[^>]*>/g, "").slice(0, 150)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Templates</DialogTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCreateBlank}>
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Blank Page
                </Button>
                <Button size="sm" onClick={handleCreateNew}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create Template
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Search + Category tabs */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="pl-8 h-9"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {CATEGORY_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  variant={activeCategory === tab.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveCategory(tab.value)}
                  className="h-7 text-xs"
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Template grid + preview */}
          <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
            {/* Grid */}
            <ScrollArea className="flex-1">
              {loading && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Loading templates...
                </div>
              )}
              {!loading && filteredTemplates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No templates match your search" : "No templates in this category"}
                  </p>
                </div>
              )}
              {!loading && filteredTemplates.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pr-2">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      tabIndex={0}
                      onClick={() => setPreviewTemplate(template)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setPreviewTemplate(template) }}
                      className={cn(
                        "border rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm",
                        previewTemplate?.id === template.id
                          ? "border-primary ring-1 ring-primary/20"
                          : "hover:border-muted-foreground/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="text-sm font-medium truncate">{template.name}</h4>
                        <Badge
                          variant="secondary"
                          className={cn("text-[10px] shrink-0", CATEGORY_COLORS[template.category])}
                        >
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {template.description || stripHtml(template.content)}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          className="h-6 text-[11px] px-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUseTemplate(template)
                          }}
                        >
                          Use
                        </Button>
                        {template.is_system ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCustomize(template)
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Customize
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-2"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(template)
                              }}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-2 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirmId(template.id)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Preview panel */}
            {previewTemplate && (
              <div className="w-80 shrink-0 border rounded-lg flex flex-col overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/30">
                  <h4 className="text-sm font-semibold">{previewTemplate.name}</h4>
                  {previewTemplate.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{previewTemplate.description}</p>
                  )}
                </div>
                <ScrollArea className="flex-1 p-3">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewTemplate.content }}
                  />
                </ScrollArea>
                <div className="px-3 py-2 border-t">
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => handleUseTemplate(previewTemplate)}
                  >
                    Use This Template
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template editor dialog */}
      <NotedTemplateEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingTemplate(null)
        }}
        onSave={handleSaveTemplate}
        initialName={editingTemplate?.is_system ? `${editingTemplate.name} (Custom)` : editingTemplate?.name || ""}
        initialDescription={editingTemplate?.description || ""}
        initialCategory={editingTemplate?.category || "general"}
        initialContent={editingTemplate?.content || ""}
        title={
          (() => {
            if (editingTemplate?.is_system) return "Customize Template"
            if (editingTemplate) return "Edit Template"
            return "Create Template"
          })()
        }
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) deleteTemplate(deleteConfirmId)
                setDeleteConfirmId(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
