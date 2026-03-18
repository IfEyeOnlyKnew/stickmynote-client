"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Edit2, GripVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Category {
  id: string
  name: string
  description: string | null
  display_order: number
}

interface ManageCategoriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

export function ManageCategoriesDialog({ open, onOpenChange, onUpdate }: ManageCategoriesDialogProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")

  useEffect(() => {
    if (open) {
      fetchCategories()
    }
  }, [open])

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/inference-pad-categories")
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const handleCreate = async () => {
    if (!newCategoryName.trim()) return

    try {
      setLoading(true)
      const response = await fetch("/api/inference-pad-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName,
          description: newCategoryDescription,
        }),
      })

      if (response.ok) {
        setNewCategoryName("")
        setNewCategoryDescription("")
        fetchCategories()
        onUpdate()
      }
    } catch (error) {
      console.error("Error creating category:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (categoryId: string) => {
    if (!editName.trim()) return

    try {
      setLoading(true)
      const response = await fetch(`/api/inference-pad-categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
        }),
      })

      if (response.ok) {
        setEditingId(null)
        setEditName("")
        setEditDescription("")
        fetchCategories()
        onUpdate()
      }
    } catch (error) {
      console.error("Error updating category:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm("Are you sure? Pads in this category will be uncategorized.")) return

    try {
      setLoading(true)
      const response = await fetch(`/api/inference-pad-categories/${categoryId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchCategories()
        onUpdate()
      }
    } catch (error) {
      console.error("Error deleting category:", error)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (category: Category) => {
    setEditingId(category.id)
    setEditName(category.name)
    setEditDescription(category.description || "")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditDescription("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Manage Categories
          </DialogTitle>
          <DialogDescription>
            Organize your Inference Pads into categories. Categories help group related pads together in Public and Private
            views.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Create New Category */}
          <Card className="border-2 border-dashed border-purple-200 bg-purple-50/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Create New Category</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Category name (e.g., Flight Operations, Cabin Crew)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  maxLength={100}
                  className="border-gray-300"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="border-gray-300 resize-none"
                />
                <Button
                  onClick={handleCreate}
                  disabled={!newCategoryName.trim() || loading}
                  className="w-full inference-gradient text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Category
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Categories */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Your Categories ({categories.length})</h3>
            {categories.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-gray-500">
                  <p>No categories yet. Create your first category above!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <Card key={category.id} className="border hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      {editingId === category.id ? (
                        <div className="space-y-3">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={100}
                            className="border-gray-300"
                          />
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            maxLength={500}
                            rows={2}
                            className="border-gray-300 resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleUpdate(category.id)}
                              disabled={!editName.trim() || loading}
                              size="sm"
                              className="inference-gradient text-white"
                            >
                              Save
                            </Button>
                            <Button onClick={cancelEdit} variant="outline" size="sm">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <GripVertical className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900">{category.name}</h4>
                              {category.description && (
                                <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              onClick={() => startEdit(category)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(category.id)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
