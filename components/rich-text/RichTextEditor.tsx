"use client"

import type React from "react"

import { useEditor, EditorContent } from "@tiptap/react"
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
import {
  createFullEditorExtensions,
  getEditorProseClasses,
  ToolbarButton,
  ToolbarDivider,
  EditorLoading,
  EditorError,
  EditorFooter,
  useEditorImageUpload,
} from "./shared-editor-utils"

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  readOnly?: boolean
  maxLength?: number
  onExpandClick?: () => void
  className?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  readOnly = false,
  maxLength = 500,
  onExpandClick,
  className,
}: Readonly<RichTextEditorProps>) {
  const isExternalUpdate = useRef(false)
  const lastContent = useRef(content)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    extensions: createFullEditorExtensions(),
    content,
    editable: !readOnly,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
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

  const {
    isUploadingImage,
    fileInputRef,
    handlePaste,
    handleImageButtonClick,
    handleFileChange,
  } = useEditorImageUpload(editor)

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
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" aria-label="Upload image" />

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
      <EditorFooter
        currentLength={currentLength}
        maxLength={maxLength}
        extraInfo={isUploadingImage ? "Uploading image..." : undefined}
      />
    </div>
  )
}
