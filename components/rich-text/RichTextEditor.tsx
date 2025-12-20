"use client"

import type React from "react"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { Link } from "@tiptap/extension-link"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { common, createLowlight } from "lowlight"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Maximize2,
  ImageIcon,
  Link2,
  TableIcon,
  Trash2,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useCallback, useState } from "react"
import { toast } from "sonner"

const lowlight = createLowlight(common)

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  readOnly?: boolean
  maxLength?: number
  onExpandClick?: () => void
  className?: string
}

// Extracted loading state component
function EditorLoading({ className }: { className?: string }) {
  return (
    <div className={cn("border border-gray-300 rounded-md p-3 min-h-[120px] bg-gray-50", className)}>
      <div className="animate-pulse flex items-center justify-center h-full">
        <div className="text-gray-500">Loading rich text editor...</div>
      </div>
    </div>
  )
}

// Extracted error state component
function EditorError({ 
  error, 
  className, 
  onReload 
}: { 
  error: string
  className?: string
  onReload: () => void 
}) {
  return (
    <div className={cn("border border-red-300 rounded-md p-3 min-h-[120px] bg-red-50", className)}>
      <div className="text-red-600">
        <p className="font-medium">Editor Error</p>
        <p className="text-sm">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 bg-transparent"
          onClick={onReload}
        >
          Reload Editor
        </Button>
      </div>
    </div>
  )
}

// Check if clipboard item is an image
function findImageInClipboard(items: DataTransferItemList): File | null {
  for (const item of Array.from(items)) {
    if (item.type.includes("image")) {
      return item.getAsFile()
    }
  }
  return null
}

// Pre-configured TipTap extensions
const createEditorExtensions = () => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,
  }),
  Underline,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  CodeBlockLowlight.configure({
    lowlight,
    HTMLAttributes: { class: "bg-gray-900 text-gray-100 p-4 rounded-md my-2 overflow-x-auto" },
  }),
  Image.configure({
    inline: true,
    allowBase64: true,
    HTMLAttributes: { class: "max-w-full h-auto rounded-md my-2" },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: "text-blue-600 underline hover:text-blue-800 cursor-pointer",
      target: "_blank",
      rel: "noopener noreferrer",
    },
  }),
  Table.configure({
    resizable: true,
    HTMLAttributes: { class: "border-collapse table-auto w-full my-4" },
  }),
  TableRow.configure({ HTMLAttributes: { class: "border border-gray-300" } }),
  TableHeader.configure({ HTMLAttributes: { class: "border border-gray-300 bg-gray-100 font-bold p-2 text-left" } }),
  TableCell.configure({ HTMLAttributes: { class: "border border-gray-300 p-2" } }),
]

// Editor prose classes
const getEditorProseClasses = (readOnly: boolean) => cn(
  "prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3",
  "prose-headings:font-semibold prose-headings:text-gray-900",
  "prose-p:text-gray-700 prose-p:leading-relaxed",
  "prose-strong:text-gray-900 prose-em:text-gray-700",
  "prose-ul:text-gray-700 prose-ol:text-gray-700",
  "prose-blockquote:text-gray-600 prose-blockquote:border-gray-300",
  "prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800",
  "prose-table:border-collapse prose-table:w-full",
  "prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:p-2 prose-th:text-left",
  "prose-td:border prose-td:border-gray-300 prose-td:p-2",
  "prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
  "prose-pre:bg-gray-900 prose-pre:text-gray-100",
  readOnly && "prose-p:text-gray-900",
)

// Toolbar button component
interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  title: string
  icon: React.ReactNode
  disabled?: boolean
}

function ToolbarButton({ onClick, isActive, title, icon, disabled }: Readonly<ToolbarButtonProps>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn("h-8 w-8 p-0", isActive && "bg-gray-200")}
      title={title}
      disabled={disabled}
    >
      {icon}
    </Button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-300 mx-1" />
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  readOnly = false,
  maxLength = 500,
  onExpandClick,
  className,
}: RichTextEditorProps) {
  const isExternalUpdate = useRef(false)
  const lastContent = useRef(content)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback(
    (newContent: string) => {
      if (newContent !== lastContent.current) {
        lastContent.current = newContent
        onChange(newContent)
      }
    },
    [onChange],
  )

  const editor = useEditor({
    extensions: createEditorExtensions(),
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return
      
      try {
        const html = editor.getHTML()
        const text = editor.getText()

        if (text.length <= maxLength) {
          handleChange(html)
        } else {
          isExternalUpdate.current = true
          editor.commands.setContent(lastContent.current)
          isExternalUpdate.current = false
        }
      } catch (err) {
        console.error("[v0] RichTextEditor update error:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      }
    },
    onCreate: ({ editor }) => {
      setIsLoading(false)
      setError(null)
    },
    editorProps: {
      attributes: { class: getEditorProseClasses(readOnly) },
      handleKeyDown: (view, event) => {
        if (!editor || !(event.ctrlKey || event.metaKey)) return false
        
        const key = event.key.toLowerCase()
        const editorShortcuts = ["b", "i", "u", "z", "y"]

        if (!editorShortcuts.includes(key)) return false
        
        event.preventDefault()
        event.stopPropagation()

        const shortcutActions: Record<string, () => void> = {
          b: () => editor.chain().focus().toggleBold().run(),
          i: () => editor.chain().focus().toggleItalic().run(),
          u: () => editor.chain().focus().toggleUnderline().run(),
          z: () => event.shiftKey 
            ? editor.chain().focus().redo().run() 
            : editor.chain().focus().undo().run(),
          y: () => editor.chain().focus().redo().run(),
        }

        shortcutActions[key]?.()
        return true
      },
    },
  })

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return

      setIsUploadingImage(true)
      try {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Upload failed")
        }

        const data = await response.json()

        // Insert image at current cursor position
        editor.chain().focus().setImage({ src: data.url }).run()
        toast.success("Image uploaded successfully")
      } catch (error) {
        console.error("[v0] Image upload error:", error)
        toast.error(error instanceof Error ? error.message : "Failed to upload image")
      } finally {
        setIsUploadingImage(false)
      }
    },
    [editor],
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (!editor) return

      const items = event.clipboardData?.items
      if (!items) return

      const imageFile = findImageInClipboard(items)
      if (imageFile) {
        event.preventDefault()
        handleImageUpload(imageFile)
      }
    },
    [editor, handleImageUpload],
  )

  // Attach paste event listener
  useEffect(() => {
    if (!editor) return
    
    const editorElement = editor.view.dom
    editorElement.addEventListener("paste", handlePaste as EventListener)
    
    return () => {
      editorElement.removeEventListener("paste", handlePaste as EventListener)
    }
  }, [editor, handlePaste])

  useEffect(() => {
    if (!editor && !isLoading) {
      setError("Failed to initialize editor")
    }
  }, [editor, isLoading])

  useEffect(() => {
    if (editor && content !== lastContent.current) {
      isExternalUpdate.current = true
      editor.commands.setContent(content)
      lastContent.current = content
      isExternalUpdate.current = false
    }
  }, [editor, content])

  const handleAddLink = useCallback(() => {
    if (!editor) return

    const url = globalThis.prompt("Enter URL:")
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        handleImageUpload(file)
      }
      // Reset input so same file can be selected again
      event.target.value = ""
    },
    [handleImageUpload],
  )

  const handleReload = useCallback(() => {
    setError(null)
    setIsLoading(true)
    globalThis.location.reload()
  }, [])

  // Prevent default keyboard shortcuts that we handle in the editor
  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const key = e.key.toLowerCase()
    if (["i", "b", "u", "z", "y"].includes(key)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  if (error) {
    return <EditorError error={error} className={className} onReload={handleReload} />
  }

  if (isLoading || !editor) {
    return <EditorLoading className={className} />
  }

  const currentLength = editor.getText().length

  return (
    <div
      role="textbox"
      tabIndex={0}
      className={cn("border border-gray-300 rounded-md", className)}
      onKeyDown={handleContainerKeyDown}
    >
      {!readOnly && (
        <div className="border-b border-gray-200 p-2 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-1 flex-wrap">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive("heading", { level: 1 })}
              title="Heading 1"
              icon={<Heading1 className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive("heading", { level: 2 })}
              title="Heading 2"
              icon={<Heading2 className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive("heading", { level: 3 })}
              title="Heading 3"
              icon={<Heading3 className="h-4 w-4" />}
            />

            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="Bold (Ctrl+B)"
              icon={<Bold className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="Italic (Ctrl+I)"
              icon={<Italic className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive("underline")}
              title="Underline (Ctrl+U)"
              icon={<UnderlineIcon className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              isActive={editor.isActive("highlight")}
              title="Highlight"
              icon={<Highlighter className="h-4 w-4" />}
            />

            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              isActive={editor.isActive({ textAlign: "left" })}
              title="Align Left"
              icon={<AlignLeft className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              isActive={editor.isActive({ textAlign: "center" })}
              title="Align Center"
              icon={<AlignCenter className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              isActive={editor.isActive({ textAlign: "right" })}
              title="Align Right"
              icon={<AlignRight className="h-4 w-4" />}
            />

            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive("bulletList")}
              title="Bullet List"
              icon={<List className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive("orderedList")}
              title="Numbered List"
              icon={<ListOrdered className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive("blockquote")}
              title="Quote"
              icon={<Quote className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive("codeBlock")}
              title="Code Block"
              icon={<Code className="h-4 w-4" />}
            />

            <ToolbarDivider />

            <ToolbarButton
              onClick={handleImageButtonClick}
              disabled={isUploadingImage}
              title="Insert Image (or paste)"
              icon={<ImageIcon className="h-4 w-4" />}
            />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

            <ToolbarButton
              onClick={handleAddLink}
              isActive={editor.isActive("link")}
              title="Add Link"
              icon={<Link2 className="h-4 w-4" />}
            />

            {editor.isActive("link") && (
              <ToolbarButton
                onClick={() => editor.chain().focus().unsetLink().run()}
                title="Remove Link"
                icon={<Trash2 className="h-4 w-4" />}
              />
            )}

            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              isActive={editor.isActive("table")}
              title="Insert Table"
              icon={<TableIcon className="h-4 w-4" />}
            />

            {editor.isActive("table") && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="h-8 px-2 text-xs"
                  title="Add Column"
                >
                  +Col
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="h-8 px-2 text-xs"
                  title="Add Row"
                >
                  +Row
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="h-8 px-2 text-xs text-red-600"
                  title="Delete Table"
                >
                  Del
                </Button>
              </>
            )}

            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Ctrl+Z)"
              icon={<Undo className="h-4 w-4" />}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Ctrl+Y)"
              icon={<Redo className="h-4 w-4" />}
            />
          </div>
          {onExpandClick && (
            <ToolbarButton
              onClick={onExpandClick}
              title="Expand to full screen"
              icon={<Maximize2 className="h-4 w-4" />}
            />
          )}
        </div>
      )}
      <div className={cn(readOnly && "bg-gray-50")}>
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>
      <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <span>
          {currentLength}/{maxLength} characters
          {isUploadingImage && " • Uploading image..."}
        </span>
        {currentLength > maxLength * 0.9 && (
          <span className="text-orange-600 font-medium">{maxLength - currentLength} remaining</span>
        )}
      </div>
    </div>
  )
}
