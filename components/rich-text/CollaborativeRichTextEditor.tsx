"use client"

import type React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCursor from "@tiptap/extension-collaboration-cursor"
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
  Users,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useCallback, useState } from "react"
import { useCollaboration } from "@/lib/collaboration/use-collaboration"
import { toast } from "sonner"
import {
  createBaseEditorExtensions,
  getBaseProseClasses,
  ToolbarButton,
  ToolbarDivider,
  EditorLoading,
  EditorError,
  EditorFooter,
  useEditorImageUpload,
} from "./shared-editor-utils"

interface CollaborativeRichTextEditorProps {
  documentId: string
  content: string
  onChange: (content: string) => void
  placeholder?: string
  readOnly?: boolean
  maxLength?: number
  onExpandClick?: () => void
  className?: string
  enableCollaboration?: boolean
}

function getEditorExtraInfo(isUploading: boolean, enableCollab: boolean, connected: boolean): string | undefined {
  if (isUploading) return "Uploading image..."
  if (enableCollab && connected) return "Live collaboration enabled"
  return undefined
}

export function CollaborativeRichTextEditor({
  documentId,
  content,
  onChange,
  placeholder = "Start typing...",
  readOnly = false,
  maxLength = 500,
  onExpandClick,
  className,
  enableCollaboration = true,
}: Readonly<CollaborativeRichTextEditorProps>) {
  const isExternalUpdate = useRef(false)
  const lastContent = useRef(content)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCollaborators, setShowCollaborators] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const shouldEnableCollaboration = enableCollaboration && !readOnly

  const {
    doc,
    provider,
    isConnected,
    activeUsers,
    error: collabError,
  } = useCollaboration({
    documentId,
    enabled: shouldEnableCollaboration,
    onConnectionChange: (connected) => {
      if (connected) {
        toast.success("Connected to collaboration")
      }
    },
    onUsersChange: (users) => {
      // No action needed for now
    },
  })

  const editor = useEditor({
    extensions: [
      ...createBaseEditorExtensions(),
      ...(shouldEnableCollaboration && doc && provider
        ? [
            Collaboration.configure({
              document: doc,
              field: "content",
            }),
            CollaborationCursor.configure({
              provider: provider as any,
              user: {
                name: "User",
                color: "#FF6B6B",
              },
            }),
          ]
        : []),
    ],
    content: shouldEnableCollaboration ? undefined : content,
    editable: !readOnly,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => {
      try {
        if (!isExternalUpdate.current) {
          const html = editor.getHTML()
          const text = editor.getText()

          if (text.length <= maxLength) {
            if (debounceTimer.current) {
              clearTimeout(debounceTimer.current)
            }
            debounceTimer.current = setTimeout(() => {
              handleChange(html)
            }, 500)
          } else if (!shouldEnableCollaboration) {
            isExternalUpdate.current = true
            editor.commands.setContent(lastContent.current)
            isExternalUpdate.current = false
          }
        }
      } catch (err) {
        console.error("CollaborativeRichTextEditor update error:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      }
    },
    onCreate: ({ editor }) => {
      setIsLoading(false)
      setError(null)

      if (!shouldEnableCollaboration && content) {
        editor.commands.setContent(content)
      }

      const editorElement = editor.view.dom
      editorElement.addEventListener("paste", handlePaste as any)
    },
    onDestroy: () => {
      if (editor) {
        const editorElement = editor.view.dom
        editorElement.removeEventListener("paste", handlePaste as any)
      }
    },
    editorProps: {
      attributes: {
        class: getBaseProseClasses(readOnly),
      },
      handleKeyDown: (view, event) => {
        if (event.ctrlKey || event.metaKey) {
          const key = event.key.toLowerCase()

          if (key === "b") {
            event.preventDefault()
            editor?.chain().focus().toggleBold().run()
            return true
          } else if (key === "i") {
            event.preventDefault()
            editor?.chain().focus().toggleItalic().run()
            return true
          } else if (key === "z") {
            event.preventDefault()
            if (event.shiftKey) {
              editor?.chain().focus().redo().run()
            } else {
              editor?.chain().focus().undo().run()
            }
            return true
          }
        }
        return false
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

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (shouldEnableCollaboration && editor && doc && isConnected) {
      const yText = doc.getText("content")

      const updateHandler = () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current)
        }
        debounceTimer.current = setTimeout(() => {
          const html = editor.getHTML()
          if (html !== lastContent.current) {
            lastContent.current = html
            onChange(html)
          }
        }, 500)
      }

      yText.observe(updateHandler)

      if (content && yText.length === 0) {
        editor.commands.setContent(content)
      }

      return () => {
        yText.unobserve(updateHandler)
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current)
        }
      }
    }
  }, [editor, doc, isConnected, shouldEnableCollaboration, onChange, content])

  const handleChange = useCallback(
    (newContent: string) => {
      if (newContent !== lastContent.current) {
        lastContent.current = newContent
        onChange(newContent)
      }
    },
    [onChange],
  )

  useEffect(() => {
    if (!editor && !isLoading) {
      setError("Failed to initialize editor")
    }
  }, [editor, isLoading])

  useEffect(() => {
    if (editor && content !== lastContent.current && !shouldEnableCollaboration) {
      isExternalUpdate.current = true
      editor.commands.setContent(content)
      lastContent.current = content
      isExternalUpdate.current = false
    }
  }, [editor, content, shouldEnableCollaboration])

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

  if (error || collabError) {
    return <EditorError error={error || collabError || "Unknown error"} className={className} onReload={handleReload} />
  }

  if (isLoading || !editor) {
    return <EditorLoading className={className} message="Loading collaborative editor..." />
  }

  const currentLength = editor.getText().length

  return (
    <div className={cn("border border-gray-300 rounded-md", className)}>
      {!readOnly && (
        <div className="border-b border-gray-200 p-2 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-1 flex-wrap">
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

            {!shouldEnableCollaboration && (
              <>
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
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {shouldEnableCollaboration && (
              <>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  {isConnected ? (
                    <Wifi className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                </div>

                {activeUsers.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCollaborators(!showCollaborators)}
                    className="h-8 px-2 text-xs"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    {activeUsers.length}
                  </Button>
                )}
              </>
            )}

            {onExpandClick && (
              <ToolbarButton
                onClick={onExpandClick}
                title="Expand to full screen"
                icon={<Maximize2 className="h-4 w-4" />}
              />
            )}
          </div>
        </div>
      )}

      {showCollaborators && activeUsers.length > 0 && (
        <div className="border-b border-gray-200 p-2 bg-blue-50">
          <div className="text-xs font-medium text-gray-700 mb-1">Active Collaborators:</div>
          <div className="flex flex-wrap gap-2">
            {activeUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
                <span>{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn(readOnly && "bg-gray-50")}>
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>
      <EditorFooter
        currentLength={currentLength}
        maxLength={maxLength}
        extraInfo={getEditorExtraInfo(isUploadingImage, shouldEnableCollaboration, isConnected)}
      />
    </div>
  )
}
