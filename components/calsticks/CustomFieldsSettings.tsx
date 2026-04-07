"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Settings2 } from "lucide-react"

interface CustomField {
  id: string
  name: string
  type: "text" | "number" | "select" | "date" | "boolean" | "url"
  options?: string[]
  description?: string
  is_required: boolean
}

export function CustomFieldsSettings() {
  const [fields, setFields] = useState<CustomField[]>([])
  const [_loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [newField, setNewField] = useState<Partial<CustomField>>({
    type: "text",
    is_required: false,
  })
  const [optionsInput, setOptionsInput] = useState("")

  useEffect(() => {
    if (isOpen) {
      fetchFields()
    }
  }, [isOpen])

  const fetchFields = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/calsticks/custom-fields")
      if (response.ok) {
        const data = await response.json()
        setFields(data.fields || [])
      }
    } catch (error) {
      console.error("Failed to fetch fields:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const fieldData = {
        ...newField,
        options:
          newField.type === "select"
            ? optionsInput
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
      }

      const response = await fetch("/api/calsticks/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldData),
      })

      if (response.ok) {
        fetchFields()
        setNewField({ type: "text", is_required: false })
        setOptionsInput("")
      }
    } catch (error) {
      console.error("Failed to create field:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/calsticks/custom-fields?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchFields()
      }
    } catch (error) {
      console.error("Failed to delete field:", error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          Custom Fields
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage Custom Fields</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-5 gap-4 items-end border-b pb-4">
            <div className="col-span-2 space-y-2">
              <Label>Field Name</Label>
              <Input
                value={newField.name || ""}
                onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                placeholder="e.g. Client Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newField.type} onValueChange={(val: any) => setNewField({ ...newField, type: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="boolean">Checkbox</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newField.type === "select" && (
              <div className="space-y-2">
                <Label>Options (comma separated)</Label>
                <Input
                  value={optionsInput}
                  onChange={(e) => setOptionsInput(e.target.value)}
                  placeholder="Option 1, Option 2"
                />
              </div>
            )}
            <Button onClick={handleCreate} disabled={!newField.name}>
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.name}</TableCell>
                    <TableCell className="capitalize">{field.type}</TableCell>
                    <TableCell>{field.options?.join(", ")}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(field.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {fields.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No custom fields defined yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
