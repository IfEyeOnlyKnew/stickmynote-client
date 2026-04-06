"use client"

import type React from "react"
import { useCallback, useRef, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Editor } from "@tiptap/react"

// Shared lowlight instance
export const lowlight = createLowlight(common)

// ============================================================================
// EXTENSIONS
// ============================================================================

/** Shared TipTap extensions for the full editor (headings, underline, highlight, text align, code blocks). */
export function createFullEditorExtensions() {
  return [
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
}

/** Base extensions without heading-level config, underline, highlight, text align, code blocks. Used by collaborative editor. */
export function createBaseEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
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
}

// ============================================================================
// PROSE CLASSES
// ============================================================================

/** Full prose classes (used by RichTextEditor with code block styling). */
export function getEditorProseClasses(readOnly: boolean) {
  return cn(
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
}

/** Base prose classes (without code styling). */
export function getBaseProseClasses(readOnly: boolean) {
  return cn(
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
    readOnly && "prose-p:text-gray-900",
  )
}

// ============================================================================
// TOOLBAR COMPONENTS
// ============================================================================

export interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  title: string
  icon: React.ReactNode
  disabled?: boolean
}

export function ToolbarButton({ onClick, isActive, title, icon, disabled }: Readonly<ToolbarButtonProps>) {
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

export function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-300 mx-1" />
}

// ============================================================================
// STATUS COMPONENTS
// ============================================================================

export function EditorLoading({ className, message = "Loading rich text editor..." }: Readonly<{ className?: string; message?: string }>) {
  return (
    <div className={cn("border border-gray-300 rounded-md p-3 min-h-[120px] bg-gray-50", className)}>
      <div className="animate-pulse flex items-center justify-center h-full">
        <div className="text-gray-500">{message}</div>
      </div>
    </div>
  )
}

export function EditorError({
  error,
  className,
  onReload,
}: Readonly<{
  error: string
  className?: string
  onReload: () => void
}>) {
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

export function EditorFooter({
  currentLength,
  maxLength,
  extraInfo,
}: Readonly<{
  currentLength: number
  maxLength: number
  extraInfo?: string
}>) {
  return (
    <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
      <span>
        {currentLength}/{maxLength} characters
        {extraInfo && ` • ${extraInfo}`}
      </span>
      {currentLength > maxLength * 0.9 && (
        <span className="text-orange-600 font-medium">{maxLength - currentLength} remaining</span>
      )}
    </div>
  )
}

// ============================================================================
// IMAGE UPLOAD HOOK
// ============================================================================

/** Check if clipboard item is an image */
export function findImageInClipboard(items: DataTransferItemList): File | null {
  for (const item of Array.from(items)) {
    if (item.type.includes("image")) {
      return item.getAsFile()
    }
  }
  return null
}

/** Shared image upload logic for TipTap editors. */
export function useEditorImageUpload(editor: Editor | null) {
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        handleImageUpload(file)
      }
      event.target.value = ""
    },
    [handleImageUpload],
  )

  return {
    isUploadingImage,
    fileInputRef,
    handleImageUpload,
    handlePaste,
    handleImageButtonClick,
    handleFileChange,
  }
}
