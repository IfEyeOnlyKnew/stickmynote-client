"use client"

import { useState, useEffect, useMemo } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, Plus, Search, ThumbsUp, Eye, Pin, ExternalLink, Trash2, Edit, X, Save, FileText } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

// Default categories - will be extended with custom categories from articles
const DEFAULT_KB_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "sop", label: "SOP" },
  { value: "pattern", label: "Pattern" },
  { value: "best-practice", label: "Best Practice" },
  { value: "troubleshooting", label: "Troubleshooting" },
  { value: "reference", label: "Reference" },
  { value: "faq", label: "FAQ" },
  { value: "guideline", label: "Guideline" },
  { value: "template", label: "Template" },
  { value: "tribal-knowledge", label: "Tribal Knowledge" },
]

interface KBArticle {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  author_id: string
  created_at: string
  updated_at: string
  version: number
  is_pinned: boolean
  view_count: number
  helpful_count: number
  author?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

interface KnowledgeBaseDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  padId: string
  onSelectArticle?: (article: KBArticle) => void
}

export function KnowledgeBaseDrawer({ open, onOpenChange, padId, onSelectArticle }: KnowledgeBaseDrawerProps) {
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isCreating, setIsCreating] = useState(false)
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formCategory, setFormCategory] = useState("general")
  const [formTags, setFormTags] = useState("")

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open && padId) {
      fetchArticles()
    }
  }, [open, padId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchArticles = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/inference-pads/${padId}/knowledge-base`)
      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching KB articles:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateArticle = async () => {
    if (!formTitle.trim() || !formContent.trim()) return

    try {
      const response = await fetch(`/api/inference-pads/${padId}/knowledge-base`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          category: formCategory,
          tags: formTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setArticles([data.article, ...articles])
        setIsCreating(false)
        setFormTitle("")
        setFormContent("")
        setFormCategory("general")
        setFormTags("")
      }
    } catch (error) {
      console.error("[v0] Error creating article:", error)
    }
  }

  const handleUpdateArticle = async (articleId: string) => {
    if (!formTitle.trim() || !formContent.trim()) return

    try {
      const response = await fetch(`/api/inference-pads/${padId}/knowledge-base`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          title: formTitle,
          content: formContent,
          category: formCategory,
          tags: formTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setArticles(articles.map((a) => (a.id === articleId ? data.article : a)))
        setEditingArticleId(null)
        setFormTitle("")
        setFormContent("")
        setFormCategory("general")
        setFormTags("")
      }
    } catch (error) {
      console.error("[v0] Error updating article:", error)
    }
  }

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return

    try {
      const response = await fetch(`/api/inference-pads/${padId}/knowledge-base?articleId=${articleId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setArticles(articles.filter((a) => a.id !== articleId))
      }
    } catch (error) {
      console.error("[v0] Error deleting article:", error)
    }
  }

  const handleToggleHelpful = async (articleId: string, isCurrentlyHelpful: boolean) => {
    try {
      const method = isCurrentlyHelpful ? "DELETE" : "POST"
      const response = await fetch(`/api/inference-pads/${padId}/knowledge-base/${articleId}/helpful`, {
        method,
      })

      if (response.ok) {
        await fetchArticles()
      }
    } catch (error) {
      console.error("[v0] Error toggling helpful:", error)
    }
  }

  const startEdit = (article: KBArticle) => {
    setEditingArticleId(article.id)
    setFormTitle(article.title)
    setFormContent(article.content)
    setFormCategory(article.category)
    setFormTags(article.tags.join(", "))
  }

  const cancelEdit = () => {
    setEditingArticleId(null)
    setIsCreating(false)
    setFormTitle("")
    setFormContent("")
    setFormCategory("general")
    setFormTags("")
  }

  // Build dynamic category list from articles + defaults
  const allCategories = useMemo(() => {
    const categorySet = new Set<string>()
    // Add default categories
    DEFAULT_KB_CATEGORIES.forEach((cat) => categorySet.add(cat.value))
    // Add custom categories from articles
    articles.forEach((article) => {
      if (article.category) {
        categorySet.add(article.category)
      }
    })
    // Convert to sorted array with labels
    return Array.from(categorySet)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => {
        const defaultCat = DEFAULT_KB_CATEGORIES.find((c) => c.value === value)
        return { value, label: defaultCat?.label || value }
      })
  }, [articles])

  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      searchQuery === "" ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = selectedCategory === "all" || article.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <SheetTitle>Knowledge Base</SheetTitle>
            </div>
            <Button size="sm" onClick={() => setIsCreating(true)} disabled={isCreating || editingArticleId !== null}>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </div>
          <SheetDescription>Contextual knowledge articles and references for this pad</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-120px)]">
          <div className="p-4 border-b space-y-3 shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {(isCreating || editingArticleId) && (
                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {editingArticleId ? "Edit Article" : "Create New Article"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-sm font-medium mb-2 block">Title</span>
                      <Input
                        placeholder="Article title..."
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        maxLength={200}
                      />
                    </div>

                    <div>
                      <span className="text-sm font-medium mb-2 block">Category</span>
                      <Input
                        placeholder="Enter category (e.g., SOP, FAQ, Troubleshooting...)"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        maxLength={50}
                      />
                      <p className="text-xs text-gray-500 mt-1">Type any category name. Custom categories will appear in the filter dropdown.</p>
                    </div>

                    <div>
                      <span className="text-sm font-medium mb-2 block">Content</span>
                      <Textarea
                        placeholder="Article content..."
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        rows={6}
                        maxLength={50000}
                      />
                      <p className="text-xs text-gray-500 mt-1">{formContent.length.toLocaleString()}/50,000</p>
                    </div>

                    <div>
                      <span className="text-sm font-medium mb-2 block">Tags (comma-separated)</span>
                      <Input
                        placeholder="api, authentication, setup..."
                        value={formTags}
                        onChange={(e) => setFormTags(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (editingArticleId) {
                            handleUpdateArticle(editingArticleId)
                          } else {
                            handleCreateArticle()
                          }
                        }}
                        disabled={!formTitle.trim() || !formContent.trim()}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {editingArticleId ? "Update" : "Create"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </div>
              )}
              {!loading && filteredArticles.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-gray-500">
                    {searchQuery || selectedCategory !== "all"
                      ? "No articles match your search"
                      : "No articles yet. Create the first one!"}
                  </CardContent>
                </Card>
              )}
              {!loading && filteredArticles.length > 0 && (
                filteredArticles.map((article) => (
                  <Card key={article.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {article.is_pinned && <Pin className="h-4 w-4 text-purple-600" />}
                            <Badge variant="secondary" className="text-xs">
                              {DEFAULT_KB_CATEGORIES.find((c) => c.value === article.category)?.label || article.category}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg mb-1">{article.title}</CardTitle>
                          <CardDescription className="text-sm">
                            by {article.author?.full_name || article.author?.email || "Unknown"} •{" "}
                            {formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}
                            {article.version > 1 && ` • v${article.version}`}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(article)}
                            title="Edit article"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteArticle(article.id)}
                            title="Delete article"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{article.content}</p>

                      {article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {article.view_count}
                          </div>
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4" />
                            {article.helpful_count}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleToggleHelpful(article.id, false)}>
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            Helpful
                          </Button>
                          {onSelectArticle && (
                            <Button variant="outline" size="sm" onClick={() => onSelectArticle(article)}>
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Cite
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
