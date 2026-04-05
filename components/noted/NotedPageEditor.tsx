"use client"

import { useCallback, useEffect, useState, useRef } from "react"
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
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, Code, Minus,
  Undo, Redo, Link as LinkIcon, Highlighter,
  Save, X, ExternalLink, FileText,
  Table as TableIcon, Image as ImageIcon, Video as YoutubeIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  ChevronDown, ListTree, Info, AlertTriangle, CheckCircle2, XCircle,
  Columns3, History, Bookmark, PenTool, Mic, ScanLine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useNotedVersions } from "@/hooks/useNotedVersions"
import { NotedVersionHistory } from "./NotedVersionHistory"
import { NotedPageTags } from "./NotedPageTags"
import { NotedDrawingCanvas } from "./NotedDrawingCanvas"
import { NotedAudioRecorder } from "./NotedAudioRecorder"
import { NotedOcrExtractor } from "./NotedOcrExtractor"
import type { NotedPage, NotedGroup } from "@/hooks/useNoted"

interface NotedPageEditorProps {
  page: NotedPage
  groups: NotedGroup[]
  saving: boolean
  onSave: (data: { title: string; content: string; group_id: string | null }) => void
  onCancel: () => void
  onGroupChange: (groupId: string | null) => void
  onSaveAsTemplate?: (data: { title: string; content: string }) => void
}

interface TocHeading {
  level: number
  text: string
  id: string
}

function ToolbarButton({
  onClick,
  isActive,
  children,
  title,
}: Readonly<{
  onClick: () => void
  isActive?: boolean
  children: React.ReactNode
  title: string
}>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      className={cn(
        "h-8 w-8 p-0",
        isActive && "bg-muted text-foreground"
      )}
    >
      {children}
    </Button>
  )
}

export function NotedPageEditor({ page, groups, saving, onSave, onCancel, onGroupChange, onSaveAsTemplate }: Readonly<NotedPageEditorProps>) {
  const [title, setTitle] = useState(page.title || page.display_title || "")
  const [hasChanges, setHasChanges] = useState(false)
  const [showToc, setShowToc] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showDrawingCanvas, setShowDrawingCanvas] = useState(false)
  const [showAudioRecorder, setShowAudioRecorder] = useState(false)
  const [showOcrExtractor, setShowOcrExtractor] = useState(false)
  const [tocHeadings, setTocHeadings] = useState<TocHeading[]>([])
  const contentRef = useRef(page.content || "")
  const initialTitleRef = useRef(page.title || page.display_title || "")
  const initialContentRef = useRef(page.content || "")
  const { createVersion } = useNotedVersions(page.id)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder: "Start writing..." }),
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
    content: page.content || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      contentRef.current = html
      setHasChanges(html !== initialContentRef.current || title !== initialTitleRef.current)
      updateToc(html)
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-280px)] p-4",
      },
    },
  })

  // Extract headings for TOC
  const updateToc = useCallback((html: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const headings: TocHeading[] = []
    doc.querySelectorAll("h1, h2, h3").forEach((el, i) => {
      const text = el.textContent || ""
      if (text.trim()) {
        headings.push({
          level: Number.parseInt(el.tagName[1]),
          text,
          id: `heading-${i}`,
        })
      }
    })
    setTocHeadings(headings)
  }, [])

  // Update editor content when page changes
  useEffect(() => {
    if (editor && page.content !== undefined) {
      const currentContent = editor.getHTML()
      if (currentContent !== page.content && page.content !== null) {
        editor.commands.setContent(page.content || "")
      }
    }
    const newTitle = page.title || page.display_title || ""
    setTitle(newTitle)
    initialTitleRef.current = newTitle
    initialContentRef.current = page.content || ""
    contentRef.current = page.content || ""
    setHasChanges(false)
    updateToc(page.content || "")
  }, [page.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    setHasChanges(newTitle !== initialTitleRef.current || contentRef.current !== initialContentRef.current)
  }, [])

  const handleSave = useCallback(() => {
    onSave({
      title,
      content: contentRef.current,
      group_id: page.group_id,
    })
    initialTitleRef.current = title
    initialContentRef.current = contentRef.current
    setHasChanges(false)
  }, [title, page.group_id, onSave])

  const handleCancel = useCallback(() => {
    setTitle(initialTitleRef.current)
    if (editor) {
      editor.commands.setContent(initialContentRef.current)
    }
    contentRef.current = initialContentRef.current
    setHasChanges(false)
    onCancel()
  }, [editor, onCancel])

  const handleGroupChange = useCallback((value: string) => {
    const groupId = value === "__none" ? null : value
    onGroupChange(groupId)
  }, [onGroupChange])

  const addLink = useCallback(() => {
    if (!editor) return
    const url = globalThis.prompt("Enter URL:")
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  const addImage = useCallback(() => {
    if (!editor) return
    const url = globalThis.prompt("Enter image URL:")
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const addYoutube = useCallback(() => {
    if (!editor) return
    const url = globalThis.prompt("Enter YouTube URL:")
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run()
    }
  }, [editor])

  const insertTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const scrollToHeading = useCallback((index: number) => {
    if (!editor) return
    const editorEl = editor.view.dom
    const headings = editorEl.querySelectorAll("h1, h2, h3")
    const target = headings[index]
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [editor])

  const handleSaveVersion = useCallback(async () => {
    await createVersion()
  }, [createVersion])

  const handleRestoreVersion = useCallback((restored: { title: string; content: string }) => {
    setTitle(restored.title)
    if (editor) {
      editor.commands.setContent(restored.content)
    }
    contentRef.current = restored.content
    setHasChanges(true)
    setShowVersionHistory(false)
  }, [editor])

  const handleDrawingSave = useCallback((dataUrl: string) => {
    if (!editor) return
    editor.chain().focus().setImage({ src: dataUrl }).run()
    setShowDrawingCanvas(false)
  }, [editor])

  const handleOcrInsert = useCallback((text: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(`<p>${text.replaceAll("\n", "</p><p>")}</p>`).run()
  }, [editor])

  const handleAudioInsert = useCallback((data: { audioUrl: string; transcript: string }) => {
    if (!editor) return
    // Insert transcript as a blockquote with audio label
    const content = data.transcript
      ? `<blockquote><p><strong>🎙 Audio Note</strong></p><p>${data.transcript}</p></blockquote>`
      : `<p><em>🎙 Audio note recorded (no transcript available)</em></p>`
    editor.chain().focus().insertContent(content).run()
  }, [editor])

  // Build the source stick URL — link to the specific stick
  let sourceStickUrl: string | null = null
  if (page.is_personal && page.personal_stick_id) {
    sourceStickUrl = `/personal?stick=${page.personal_stick_id}`
  } else if (!page.is_personal && page.stick_id && page.pad_id) {
    sourceStickUrl = `/pads/${page.pad_id}?stick=${page.stick_id}`
  }

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header bar with title, group selector, save/cancel, and back link */}
      <div className="px-4 pt-3 pb-2 border-b">
        <div className="flex items-start gap-3">
          {/* Title + metadata */}
          <div className="flex-1 min-w-0">
            <Input
              value={title}
              onChange={handleTitleChange}
              className="text-xl font-semibold border-none px-0 focus-visible:ring-0 shadow-none"
              placeholder="Page title..."
            />
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">
                {new Date(page.created_at).toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {saving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Save className="h-3 w-3 animate-pulse" />
                  Saving...
                </span>
              )}
              {!saving && !hasChanges && (
                <span className="text-xs text-green-600">Saved</span>
              )}
              {!saving && hasChanges && (
                <span className="text-xs text-amber-600">Unsaved changes</span>
              )}
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {/* Group selector */}
            <Select
              value={page.group_id || "__none"}
              onValueChange={handleGroupChange}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="No group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No group</SelectItem>
                {groups
                  .filter((g) => !g.parent_id)
                  .map((group) => {
                    const children = groups.filter((g) => g.parent_id === group.id)
                    return (
                      <div key={group.id}>
                        <SelectItem value={group.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: group.color }}
                            />
                            {group.name}
                          </span>
                        </SelectItem>
                        {children.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            <span className="flex items-center gap-2 pl-3">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: sub.color }}
                              />
                              {sub.name}
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                    )
                  })}
              </SelectContent>
            </Select>

            {/* Go to source Stick */}
            {sourceStickUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                asChild
              >
                <a href={sourceStickUrl}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Go to Stick
                </a>
              </Button>
            )}

            {/* Version history */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={handleSaveVersion}
              title="Save a version snapshot"
            >
              <Bookmark className="h-3.5 w-3.5" />
              Save Version
            </Button>
            <Button
              variant={showVersionHistory ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setShowVersionHistory(!showVersionHistory)}
            >
              <History className="h-3.5 w-3.5" />
              History
            </Button>

            {/* Save as Template */}
            {onSaveAsTemplate && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => onSaveAsTemplate({ title, content: contentRef.current })}
              >
                <FileText className="h-3.5 w-3.5" />
                Save as Template
              </Button>
            )}

            {/* Save / Cancel */}
            <Button
              variant="default"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={handleCancel}
              disabled={!hasChanges}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-4 py-1 border-b bg-muted/30">
        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive("taskList")} title="Task List">
          <CheckSquare className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Text alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} isActive={editor.isActive({ textAlign: "left" })} title="Align Left">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} isActive={editor.isActive({ textAlign: "center" })} title="Align Center">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} isActive={editor.isActive({ textAlign: "right" })} title="Align Right">
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()} isActive={editor.isActive({ textAlign: "justify" })} title="Justify">
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Blocks */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Quote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code Block">
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} title="Highlight">
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={addLink} isActive={editor.isActive("link")} title="Add Link">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Table */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Table">
              <TableIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={insertTable}>
              Insert 3x3 Table
            </DropdownMenuItem>
            {editor.isActive("table") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>
                  Add Column Before
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                  Add Column After
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                  Delete Column
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                  Add Row Before
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                  Add Row After
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                  Delete Row
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
                  Toggle Header Row
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().mergeCells().run()}>
                  Merge Cells
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().splitCell().run()}>
                  Split Cell
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="text-destructive"
                >
                  Delete Table
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Insert menu (image, youtube, collapsible, callout) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" title="Insert">
              <Columns3 className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={addImage}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addYoutube}>
              <YoutubeIcon className="h-4 w-4 mr-2" />
              YouTube Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowDrawingCanvas(true)}>
              <PenTool className="h-4 w-4 mr-2" />
              Drawing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowAudioRecorder(true)}>
              <Mic className="h-4 w-4 mr-2" />
              Audio Note
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowOcrExtractor(true)}>
              <ScanLine className="h-4 w-4 mr-2" />
              Extract Text (OCR)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().setDetails().run()}>
              <ChevronDown className="h-4 w-4 mr-2" />
              Collapsible Block
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().setCallout("info").run()}>
              <Info className="h-4 w-4 mr-2 text-blue-500" />
              Info Callout
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().setCallout("warning").run()}>
              <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
              Warning Callout
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().setCallout("success").run()}>
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              Success Callout
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().setCallout("error").run()}>
              <XCircle className="h-4 w-4 mr-2 text-red-500" />
              Error Callout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Table of Contents toggle */}
        <ToolbarButton onClick={() => setShowToc(!showToc)} isActive={showToc} title="Table of Contents">
          <ListTree className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Undo/Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Tags bar */}
      <NotedPageTags pageId={page.id} title={title} content={contentRef.current} />

      {/* Editor + optional TOC sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>

        {/* Version History panel */}
        {showVersionHistory && (
          <div className="w-[480px] shrink-0">
            <NotedVersionHistory
              pageId={page.id}
              currentContent={contentRef.current}
              onRestore={handleRestoreVersion}
              onClose={() => setShowVersionHistory(false)}
            />
          </div>
        )}

        {/* Table of Contents panel */}
        {showToc && !showVersionHistory && (
          <div className="w-56 shrink-0 border-l bg-muted/20">
            <div className="px-3 py-2 border-b">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Table of Contents
              </h4>
            </div>
            <ScrollArea className="h-full">
              {tocHeadings.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  Add headings (H1, H2, H3) to generate a table of contents.
                </p>
              ) : (
                <div className="py-1">
                  {tocHeadings.map((h, i) => (
                    <button
                      type="button"
                      key={h.text}
                      onClick={() => scrollToHeading(i)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors truncate",
                        h.level === 1 && "font-semibold",
                        h.level === 2 && "pl-6",
                        h.level === 3 && "pl-9 text-muted-foreground"
                      )}
                    >
                      {h.text}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Drawing canvas dialog */}
      <NotedDrawingCanvas
        open={showDrawingCanvas}
        onClose={() => setShowDrawingCanvas(false)}
        onSave={handleDrawingSave}
      />

      {/* Audio recorder dialog */}
      <NotedAudioRecorder
        open={showAudioRecorder}
        onClose={() => setShowAudioRecorder(false)}
        onInsert={handleAudioInsert}
      />

      {/* OCR extractor dialog */}
      <NotedOcrExtractor
        open={showOcrExtractor}
        onClose={() => setShowOcrExtractor(false)}
        onInsert={handleOcrInsert}
      />
    </div>
  )
}
