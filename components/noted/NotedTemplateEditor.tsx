"use client"

import { useState, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Highlight from "@tiptap/extension-highlight"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import Image from "@tiptap/extension-image"
import TextAlign from "@tiptap/extension-text-align"
import Youtube from "@tiptap/extension-youtube"
import { Details, DetailsSummary, DetailsContent } from "@/lib/tiptap/collapsible-block"
import { Callout } from "@/lib/tiptap/callout-block"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

const CATEGORIES = [
  { value: "meetings", label: "Meetings" },
  { value: "projects", label: "Projects" },
  { value: "planning", label: "Planning" },
  { value: "general", label: "General" },
]

interface NotedTemplateEditorProps {
  open: boolean
  onClose: () => void
  onSave: (data: { name: string; description: string; category: string; content: string }) => void
  initialName?: string
  initialDescription?: string
  initialCategory?: string
  initialContent?: string
  title?: string
}

export function NotedTemplateEditor({
  open,
  onClose,
  onSave,
  initialName = "",
  initialDescription = "",
  initialCategory = "general",
  initialContent = "",
  title = "Create Template",
}: Readonly<NotedTemplateEditorProps>) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [category, setCategory] = useState(initialCategory)

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Highlight,
        Link.configure({ openOnClick: false }),
        Underline,
        Placeholder.configure({ placeholder: "Write your template content..." }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Image.configure({ inline: false, allowBase64: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Youtube.configure({ width: 640, height: 360 }),
        Details,
        DetailsSummary,
        DetailsContent,
        Callout,
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-3",
        },
      },
    },
    [open, initialContent]
  )

  // Reset form when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setName(initialName)
        setDescription(initialDescription)
        setCategory(initialCategory)
      } else {
        onClose()
      }
    },
    [onClose, initialName, initialDescription, initialCategory]
  )

  const handleSave = useCallback(() => {
    if (!name.trim() || !editor) return
    onSave({
      name: name.trim(),
      description: description.trim(),
      category,
      content: editor.getHTML(),
    })
    onClose()
  }, [name, description, category, editor, onSave, onClose])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name..."
                maxLength={100}
                autoFocus
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this template..."
            maxLength={200}
            rows={2}
            className="resize-none"
          />

          <div className="border rounded-md overflow-hidden">
            <EditorContent editor={editor} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
