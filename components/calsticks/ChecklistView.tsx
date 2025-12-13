"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Plus, X, GripVertical } from "lucide-react"
import type { ChecklistItem, ChecklistData } from "@/types/checklist"
import { toast } from "@/hooks/use-toast"

interface ChecklistViewProps {
  calstickId: string
  checklist: ChecklistData
  onUpdate: (checklist: ChecklistData) => Promise<void>
  readOnly?: boolean
}

export function ChecklistView({ calstickId, checklist, onUpdate, readOnly = false }: ChecklistViewProps) {
  const [items, setItems] = useState<ChecklistItem[]>(checklist.items || [])
  const [newItemText, setNewItemText] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const completedCount = items.filter((item) => item.completed).length
  const totalCount = items.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const handleAddItem = async () => {
    if (!newItemText.trim()) return

    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      completed: false,
      order: items.length,
      created_at: new Date().toISOString(),
    }

    const updatedItems = [...items, newItem]
    setItems(updatedItems)
    setNewItemText("")
    setIsAdding(false)

    try {
      await onUpdate({ items: updatedItems })
      toast({
        title: "Checklist updated",
        description: "Item added successfully",
      })
    } catch (error) {
      console.error("Error adding checklist item:", error)
      setItems(items) // Revert on error
      toast({
        title: "Error",
        description: "Failed to add checklist item",
        variant: "destructive",
      })
    }
  }

  const handleToggleItem = async (itemId: string) => {
    const updatedItems = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
            completed_at: !item.completed ? new Date().toISOString() : null,
          }
        : item,
    )

    setItems(updatedItems)

    try {
      await onUpdate({ items: updatedItems })
    } catch (error) {
      console.error("Error toggling checklist item:", error)
      setItems(items) // Revert on error
      toast({
        title: "Error",
        description: "Failed to update checklist item",
        variant: "destructive",
      })
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    const updatedItems = items.filter((item) => item.id !== itemId)
    setItems(updatedItems)

    try {
      await onUpdate({ items: updatedItems })
      toast({
        title: "Checklist updated",
        description: "Item deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting checklist item:", error)
      setItems(items) // Revert on error
      toast({
        title: "Error",
        description: "Failed to delete checklist item",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Checklist {totalCount > 0 && `(${completedCount}/${totalCount})`}</h3>
          {totalCount > 0 && <span className="text-xs text-muted-foreground">{Math.round(progress)}% complete</span>}
        </div>
        {totalCount > 0 && <Progress value={progress} className="h-2" />}
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group transition-colors"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            <Checkbox checked={item.completed} onCheckedChange={() => handleToggleItem(item.id)} disabled={readOnly} />
            <span className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}>
              {item.text}
            </span>
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <>
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="Add checklist item..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddItem()
                  if (e.key === "Escape") {
                    setIsAdding(false)
                    setNewItemText("")
                  }
                }}
                autoFocus
                className="text-sm"
              />
              <Button size="sm" onClick={handleAddItem}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false)
                  setNewItemText("")
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="w-full justify-start">
              <Plus className="h-4 w-4 mr-2" />
              Add checklist item
            </Button>
          )}
        </>
      )}
    </div>
  )
}
