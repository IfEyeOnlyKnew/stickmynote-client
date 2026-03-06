"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserMenu } from "@/components/user-menu"
import { toast } from "@/hooks/use-toast"
import {
  ClipboardList,
  Plus,
  ExternalLink,
  Copy,
  Trash2,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { format } from "date-fns"

interface IntakeForm {
  id: string
  title: string
  description: string | null
  token: string
  pad_id: string | null
  fields: any[] | null
  is_active: boolean
  submission_count: number
  created_at: string
}

export default function FormsPage() {
  const [forms, setForms] = useState<IntakeForm[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch("/api/calsticks/intake-forms")
      if (res.ok) {
        const data = await res.json()
        setForms(data.forms || [])
      }
    } catch (error) {
      console.error("[Forms] Error:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchForms()
  }, [fetchForms])

  const handleCreate = async (formData: { title: string; description: string }) => {
    try {
      const res = await fetch("/api/calsticks/intake-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: "Form created" })
        setShowCreate(false)
        fetchForms()
      } else {
        throw new Error("Failed")
      }
    } catch {
      toast({ title: "Error", description: "Failed to create form", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this form? All submissions will be lost.")) return
    try {
      const res = await fetch(`/api/calsticks/intake-forms/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Form deleted" })
        fetchForms()
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/intake/${token}`
    navigator.clipboard.writeText(url)
    toast({ title: "Link copied to clipboard" })
  }

  const activeForms = forms.filter((f) => f.is_active !== false)
  const totalSubmissions = forms.reduce((sum, f) => sum + (f.submission_count || 0), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Forms & Work Requests
          </h1>
          <p className="text-muted-foreground">Collect work requests via shareable forms that create tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Form
          </Button>
          <UserMenu />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Forms</div>
            <div className="text-2xl font-bold">{forms.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Active Forms</div>
            <div className="text-2xl font-bold text-green-600">{activeForms.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Submissions</div>
            <div className="text-2xl font-bold">{totalSubmissions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Forms List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4"><div className="h-16 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p>No forms yet</p>
            <p className="text-sm mt-1">Create an intake form to collect work requests from your team or external clients</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-primary/70 shrink-0" />
                      <h3 className="font-semibold truncate">{form.title}</h3>
                      <Badge variant={form.is_active !== false ? "default" : "secondary"} className="text-xs">
                        {form.is_active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {form.description && (
                      <p className="text-sm text-muted-foreground mb-2 truncate">{form.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {form.submission_count || 0} submission{(form.submission_count || 0) !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {format(new Date(form.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button variant="outline" size="sm" onClick={() => copyLink(form.token)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy Link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/intake/${form.token}`, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(form.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}

function CreateFormDialog({
  open,
  onClose,
  onCreate,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onCreate: (data: { title: string; description: string }) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  const handleSubmit = () => {
    if (!title.trim()) return
    onCreate({ title: title.trim(), description: description.trim() })
    setTitle("")
    setDescription("")
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Work Request Form</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Form Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Design Request" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of requests will this form collect?"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!title.trim()}>Create Form</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
