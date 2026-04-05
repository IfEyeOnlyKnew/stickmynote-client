"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserMenu } from "@/components/user-menu"
import { toast } from "@/hooks/use-toast"
import {
  ClipboardList,
  Plus,
  Copy,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Settings2,
  Eye,
  Save,
  X,
} from "lucide-react"
import { format } from "date-fns"

interface FormField {
  id?: string
  field_name: string
  field_label: string
  field_type: string
  field_options?: string[]
  is_required: boolean
  placeholder?: string
  help_text?: string
  order_index: number
}

interface IntakeForm {
  id: string
  title: string
  description: string | null
  share_token: string
  token?: string
  pad_id: string | null
  fields: FormField[] | null
  is_active: boolean
  submission_count: number
  created_at: string
  default_priority: string
  default_status: string
  success_message: string
}

const FIELD_TYPES = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "select", label: "Dropdown" },
]

const DEFAULT_FIELDS: FormField[] = [
  { field_name: "name", field_label: "Your Name", field_type: "text", is_required: true, placeholder: "Full name", order_index: 0 },
  { field_name: "email", field_label: "Email", field_type: "email", is_required: true, placeholder: "you@example.com", order_index: 1 },
  { field_name: "description", field_label: "Description", field_type: "textarea", is_required: true, placeholder: "Describe your request...", order_index: 2 },
]

export default function FormsPage() {
  const [forms, setForms] = useState<IntakeForm[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingForm, setEditingForm] = useState<IntakeForm | null>(null)

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
        const data = await res.json()
        toast({ title: "Form created" })
        setShowCreate(false)
        fetchForms()
        // Open the field editor for the new form
        if (data.form) {
          setEditingForm({ ...data.form, fields: DEFAULT_FIELDS, submission_count: 0 })
        }
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

  const handleEditForm = async (form: IntakeForm) => {
    // Fetch form fields from public intake API using token
    const token = form.share_token || form.token
    if (token) {
      try {
        const res = await fetch(`/api/intake/${token}`)
        if (res.ok) {
          const data = await res.json()
          setEditingForm({ ...form, fields: data.form?.fields || [] })
          return
        }
      } catch {
        // Fall through
      }
    }
    setEditingForm({ ...form, fields: form.fields || [] })
  }

  const copyLink = (form: IntakeForm) => {
    const token = form.share_token || form.token
    const url = `${globalThis.location.origin}/intake/${token}`
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
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4"><div className="h-16 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      )}
      {!loading && forms.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p>No forms yet</p>
            <p className="text-sm mt-1">Create an intake form to collect work requests from your team or external clients</p>
          </CardContent>
        </Card>
      )}
      {!loading && forms.length > 0 && (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-primary/70 shrink-0" />
                      <h3 className="font-semibold truncate">{form.title}</h3>
                      <Badge variant={form.is_active === false ? "secondary" : "default"} className="text-xs">
                        {form.is_active === false ? "Inactive" : "Active"}
                      </Badge>
                    </div>
                    {form.description && (
                      <p className="text-sm text-muted-foreground mb-2 truncate">{form.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {form.submission_count || 0} submission{(form.submission_count || 0) === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {format(new Date(form.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button variant="outline" size="sm" onClick={() => handleEditForm(form)}>
                      <Settings2 className="h-3.5 w-3.5 mr-1" />
                      Fields
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copyLink(form)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy Link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const token = form.share_token || form.token
                        window.open(`/intake/${token}`, "_blank")
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
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

      {editingForm && (
        <FieldBuilderDialog
          form={editingForm}
          onClose={() => { setEditingForm(null); fetchForms() }}
        />
      )}
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

function FieldBuilderDialog({
  form,
  onClose,
}: {
  readonly form: IntakeForm
  readonly onClose: () => void
}) {
  const [fields, setFields] = useState<FormField[]>(form.fields || [])
  const [saving, setSaving] = useState(false)

  const addField = () => {
    const nextIndex = fields.length
    setFields([
      ...fields,
      {
        field_name: `field_${nextIndex}`,
        field_label: "New Field",
        field_type: "text",
        is_required: false,
        placeholder: "",
        help_text: "",
        order_index: nextIndex,
      },
    ])
  }

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)))
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order_index: i })))
  }

  const moveField = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= fields.length) return
    const newFields = [...fields]
    const temp = newFields[index]
    newFields[index] = newFields[newIndex]
    newFields[newIndex] = temp
    setFields(newFields.map((f, i) => ({ ...f, order_index: i })))
  }

  const saveFields = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/calsticks/intake-forms/${form.id}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      })
      if (res.ok) {
        toast({ title: "Fields saved" })
        onClose()
      } else {
        throw new Error("Failed")
      }
    } catch {
      toast({ title: "Error", description: "Failed to save fields", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Form Fields: {form.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {fields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No fields yet. Add fields to collect information from submitters.
            </div>
          )}

          {fields.map((field, index) => (
            <Card key={field.field_name} className="border">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveField(index, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <GripVertical className="h-4 w-4 text-muted-foreground mx-auto" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveField(index, 1)}
                      disabled={index === fields.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={field.field_label}
                          onChange={(e) => {
                            const label = e.target.value
                            const name = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replaceAll(/^_|_$/g, "")
                            updateField(index, { field_label: label, field_name: name || `field_${index}` })
                          }}
                          placeholder="Field label"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={field.field_type}
                          onValueChange={(val) => updateField(index, { field_type: val })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Placeholder</Label>
                        <Input
                          value={field.placeholder || ""}
                          onChange={(e) => updateField(index, { placeholder: e.target.value })}
                          placeholder="Placeholder text"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {field.field_type === "select" && (
                      <div>
                        <Label className="text-xs">Options (comma-separated)</Label>
                        <Input
                          value={(field.field_options || []).join(", ")}
                          onChange={(e) =>
                            updateField(index, {
                              field_options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                            })
                          }
                          placeholder="Option 1, Option 2, Option 3"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.is_required}
                          onCheckedChange={(checked) => updateField(index, { is_required: checked })}
                          id={`req-${index}`}
                        />
                        <Label htmlFor={`req-${index}`} className="text-xs">Required</Label>
                      </div>
                      <div className="flex-1">
                        <Input
                          value={field.help_text || ""}
                          onChange={(e) => updateField(index, { help_text: e.target.value })}
                          placeholder="Help text (optional)"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-500 shrink-0"
                    onClick={() => removeField(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full" onClick={addField}>
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={saveFields} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Fields"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
