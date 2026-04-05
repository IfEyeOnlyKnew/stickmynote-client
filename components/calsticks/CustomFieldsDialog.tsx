"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CustomField {
  id: string
  name: string
  type: "text" | "number" | "date" | "dropdown" | "checkbox"
  description?: string
  is_required: boolean
  options?: string[]
}

interface CustomFieldsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomFieldsDialog({ open, onOpenChange }: Readonly<CustomFieldsDialogProps>) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newField, setNewField] = useState<Partial<CustomField>>({
    name: "",
    type: "text",
    description: "",
    is_required: false,
    options: [],
  })
  const [optionInput, setOptionInput] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchFields = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/calsticks/custom-fields")
      if (response.ok) {
        const data = await response.json()
        setFields(data.fields || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to load custom fields",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching custom fields:", error)
      toast({
        title: "Error",
        description: "Failed to load custom fields",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = async () => {
    if (!newField.name || !newField.type) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/calsticks/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newField),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Custom field added successfully",
        })
        setShowAddForm(false)
        setNewField({
          name: "",
          type: "text",
          description: "",
          is_required: false,
          options: [],
        })
        setOptionInput("")
        fetchFields()
      } else {
        toast({
          title: "Error",
          description: "Failed to add custom field",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding custom field:", error)
      toast({
        title: "Error",
        description: "Failed to add custom field",
        variant: "destructive",
      })
    }
  }

  const handleDeleteField = async (id: string) => {
    try {
      const response = await fetch(`/api/calsticks/custom-fields?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Custom field deleted successfully",
        })
        fetchFields()
      } else {
        toast({
          title: "Error",
          description: "Failed to delete custom field",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting custom field:", error)
      toast({
        title: "Error",
        description: "Failed to delete custom field",
        variant: "destructive",
      })
    }
  }

  const addOption = () => {
    if (optionInput.trim() && newField.options) {
      setNewField({
        ...newField,
        options: [...newField.options, optionInput.trim()],
      })
      setOptionInput("")
    }
  }

  const removeOption = (index: number) => {
    if (newField.options) {
      setNewField({
        ...newField,
        options: newField.options.filter((_, i) => i !== index),
      })
    }
  }

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: "Text",
      number: "Number",
      date: "Date",
      dropdown: "Dropdown",
      checkbox: "Checkbox",
    }
    return labels[type] || type
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom Fields Settings</DialogTitle>
          <DialogDescription>
            Manage custom fields for your tasks. Add fields to track additional information specific to your workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading && (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          )}
          {!loading && fields.length === 0 && !showAddForm && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">No custom fields yet.</p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Field
              </Button>
            </div>
          )}
          {!loading && (fields.length > 0 || showAddForm) && (
            <>
              {/* Existing Fields List */}
              {fields.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Existing Fields</h3>
                  {fields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.name}</span>
                          {field.is_required && <span className="text-xs text-red-500">*Required</span>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Type: {getFieldTypeLabel(field.type)}
                          {field.description && ` • ${field.description}`}
                        </div>
                        {field.options && field.options.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">Options: {field.options.join(", ")}</div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteField(field.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Field Form */}
              {showAddForm ? (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Add New Field</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddForm(false)
                        setNewField({
                          name: "",
                          type: "text",
                          description: "",
                          is_required: false,
                          options: [],
                        })
                        setOptionInput("")
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="field-name">Field Name *</Label>
                      <Input
                        id="field-name"
                        value={newField.name}
                        onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                        placeholder="e.g., Priority, Department, Status"
                      />
                    </div>

                    <div>
                      <Label htmlFor="field-type">Field Type *</Label>
                      <Select
                        value={newField.type}
                        onValueChange={(value) => setNewField({ ...newField, type: value as CustomField["type"] })}
                      >
                        <SelectTrigger id="field-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="dropdown">Dropdown</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="field-description">Description (Optional)</Label>
                      <Textarea
                        id="field-description"
                        value={newField.description}
                        onChange={(e) => setNewField({ ...newField, description: e.target.value })}
                        placeholder="Help text for this field"
                        rows={2}
                      />
                    </div>

                    {newField.type === "dropdown" && (
                      <div>
                        <Label>Dropdown Options</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            value={optionInput}
                            onChange={(e) => setOptionInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                addOption()
                              }
                            }}
                            placeholder="Enter option and press Enter"
                          />
                          <Button onClick={addOption} type="button" size="sm">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {newField.options && newField.options.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {newField.options.map((option, optIdx) => (
                              <div
                                key={option}
                                className="flex items-center gap-1 px-2 py-1 bg-background border rounded"
                              >
                                <span className="text-sm">{option}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOption(optIdx)}
                                  className="h-4 w-4 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is-required"
                        checked={newField.is_required}
                        onCheckedChange={(checked) => setNewField({ ...newField, is_required: !!checked })}
                      />
                      <Label htmlFor="is-required" className="cursor-pointer">
                        Required field
                      </Label>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false)
                          setNewField({
                            name: "",
                            type: "text",
                            description: "",
                            is_required: false,
                            options: [],
                          })
                          setOptionInput("")
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleAddField}>Add Field</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Field
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
