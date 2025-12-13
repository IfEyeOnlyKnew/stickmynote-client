"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LinkIcon, BookOpen, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

const CITATION_TYPES = [
  { value: "reference", label: "Reference", description: "General reference or source" },
  { value: "related", label: "Related", description: "Related information or context" },
  { value: "resolution", label: "Resolution", description: "Solution or resolution to a problem" },
  { value: "context", label: "Context", description: "Background or contextual information" },
  { value: "prerequisite", label: "Prerequisite", description: "Required knowledge or setup" },
] as const

interface AddCitationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  padId: string
  onCitationAdded: () => void
}

export function AddCitationModal({ open, onOpenChange, stickId, padId, onCitationAdded }: AddCitationModalProps) {
  const [citationType, setCitationType] = useState("reference")
  const [sourceType, setSourceType] = useState<"kb" | "external">("kb")
  const [selectedKBArticle, setSelectedKBArticle] = useState<string>("")
  const [externalUrl, setExternalUrl] = useState("")
  const [externalTitle, setExternalTitle] = useState("")
  const [citationNote, setCitationNote] = useState("")
  const [kbArticles, setKBArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && padId) {
      fetchKBArticles()
    }
  }, [open, padId])

  const fetchKBArticles = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/social-pads/${padId}/knowledge-base`)
      if (response.ok) {
        const data = await response.json()
        setKBArticles(data.articles || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching KB articles:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (sourceType === "kb" && !selectedKBArticle) {
      alert("Please select a knowledge base article")
      return
    }
    if (sourceType === "external" && !externalUrl) {
      alert("Please enter an external URL")
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch(`/api/social-sticks/${stickId}/citations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citation_type: citationType,
          kb_article_id: sourceType === "kb" ? selectedKBArticle : null,
          external_url: sourceType === "external" ? externalUrl : null,
          external_title: sourceType === "external" ? externalTitle : null,
          citation_note: citationNote,
        }),
      })

      if (response.ok) {
        onCitationAdded()
        resetForm()
      } else {
        alert("Failed to add citation")
      }
    } catch (error) {
      console.error("[v0] Error adding citation:", error)
      alert("Error adding citation")
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setCitationType("reference")
    setSourceType("kb")
    setSelectedKBArticle("")
    setExternalUrl("")
    setExternalTitle("")
    setCitationNote("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Add Citation
          </DialogTitle>
          <DialogDescription>Link this stick to knowledge base articles or external resources</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="mb-2 block">Citation Type</Label>
            <Select value={citationType} onValueChange={setCitationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Source Type</Label>
            <RadioGroup value={sourceType} onValueChange={(v) => setSourceType(v as "kb" | "external")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="kb" id="kb" />
                <Label htmlFor="kb" className="flex items-center gap-2 cursor-pointer">
                  <BookOpen className="h-4 w-4" />
                  Knowledge Base Article
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="external" id="external" />
                <Label htmlFor="external" className="flex items-center gap-2 cursor-pointer">
                  <LinkIcon className="h-4 w-4" />
                  External Link
                </Label>
              </div>
            </RadioGroup>
          </div>

          {sourceType === "kb" && (
            <div>
              <Label className="mb-2 block">Select Article</Label>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
                </div>
              ) : kbArticles.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500">
                  No knowledge base articles found. Create one first!
                </div>
              ) : (
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  <div className="space-y-2">
                    {kbArticles.map((article) => (
                      <div
                        key={article.id}
                        className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                          selectedKBArticle === article.id ? "border-purple-500 bg-purple-50" : ""
                        }`}
                        onClick={() => setSelectedKBArticle(article.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{article.title}</div>
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{article.content}</div>
                            <div className="flex gap-1 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {article.category}
                              </Badge>
                              {article.tags.slice(0, 2).map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {sourceType === "external" && (
            <>
              <div>
                <Label className="mb-2 block">External URL</Label>
                <Input
                  placeholder="https://..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  type="url"
                />
              </div>
              <div>
                <Label className="mb-2 block">Link Title (optional)</Label>
                <Input
                  placeholder="Title of the external resource..."
                  value={externalTitle}
                  onChange={(e) => setExternalTitle(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <Label className="mb-2 block">Note (optional)</Label>
            <Textarea
              placeholder="Additional context about this citation..."
              value={citationNote}
              onChange={(e) => setCitationNote(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{citationNote.length}/500</p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              <Plus className="h-4 w-4 mr-2" />
              {submitting ? "Adding..." : "Add Citation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
