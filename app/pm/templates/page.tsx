"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserMenu } from "@/components/user-menu"
import { toast } from "@/hooks/use-toast"
import {
  LayoutTemplate,
  Plus,
  Search,
  Copy,
  Trash2,
  Edit3,
  LayoutGrid,
  List,
  Code2,
  Briefcase,
  Megaphone,
  GraduationCap,
  Palette,
  Settings2,
} from "lucide-react"

interface Template {
  id: string
  name: string
  description: string | null
  category: string
  hub_type: string | null
  structure: any
  use_count: number
  created_by: string | null
  created_at: string
}

const CATEGORY_ICONS: Record<string, typeof Briefcase> = {
  "software-dev": Code2,
  marketing: Megaphone,
  education: GraduationCap,
  design: Palette,
  operations: Settings2,
  general: LayoutTemplate,
}

const CATEGORY_LABELS: Record<string, string> = {
  "software-dev": "Software Development",
  marketing: "Marketing",
  education: "Education",
  design: "Design",
  operations: "Operations",
  general: "General",
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showCreate, setShowCreate] = useState(false)

  const fetchTemplates = useCallback(async () => {
    try {
      const url = filterCategory !== "all"
        ? `/api/pad-templates?category=${filterCategory}`
        : "/api/pad-templates"
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
        setCategories(data.categories || {})
      }
    } catch (error) {
      console.error("[Templates] Error:", error)
    } finally {
      setLoading(false)
    }
  }, [filterCategory])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleUseTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/pad-templates/${templateId}/use`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        toast({ title: "Project created from template" })
        if (data.padId) {
          window.location.href = `/paks`
        }
      } else {
        throw new Error("Failed")
      }
    } catch {
      toast({ title: "Error", description: "Failed to create from template", variant: "destructive" })
    }
  }

  const handleCreate = async (formData: { name: string; description: string; category: string }) => {
    try {
      const res = await fetch("/api/pad-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          hub_type: "calstick",
          structure: { columns: ["To Do", "In Progress", "Done"], defaultView: "kanban" },
        }),
      })
      if (res.ok) {
        toast({ title: "Template created" })
        setShowCreate(false)
        fetchTemplates()
      } else {
        throw new Error("Failed")
      }
    } catch {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return
    try {
      const res = await fetch(`/api/pad-templates/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Template deleted" })
        fetchTemplates()
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  const filtered = search
    ? templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()))
    : templates

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6 text-primary" />
            Project Templates
          </h1>
          <p className="text-muted-foreground">Start new projects from pre-built templates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
          <UserMenu />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categories).map(([cat, count]) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Templates */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4"><div className="h-20 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p>{search ? "No templates match your search" : "No templates yet"}</p>
            <p className="text-sm mt-1">Create your first template to speed up project setup</p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => {
            const Icon = CATEGORY_ICONS[template.category] || LayoutTemplate
            return (
              <Card key={template.id} className="hover:border-primary/50 transition-colors group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary/70" />
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[template.category] || template.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {template.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Used {template.use_count} time{template.use_count !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" onClick={() => handleUseTemplate(template.id)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Use Template
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((template) => {
            const Icon = CATEGORY_ICONS[template.category] || LayoutTemplate
            return (
              <Card key={template.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{template.name}</div>
                      {template.description && (
                        <div className="text-sm text-muted-foreground truncate">{template.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[template.category] || template.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{template.use_count} uses</span>
                    <Button size="sm" onClick={() => handleUseTemplate(template.id)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Use
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Template Dialog */}
      <CreateTemplateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}

function CreateTemplateDialog({
  open,
  onClose,
  onCreate,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onCreate: (data: { name: string; description: string; category: string }) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("general")

  const handleSubmit = () => {
    if (!name.trim()) return
    onCreate({ name: name.trim(), description: description.trim(), category })
    setName("")
    setDescription("")
    setCategory("general")
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Template Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sprint Planning Board" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this template for?" rows={3} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="software-dev">Software Development</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
