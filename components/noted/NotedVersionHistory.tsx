"use client"

import { useEffect, useState, useCallback } from "react"
import { History, RotateCcw, Eye, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useNotedVersions, type NotedPageVersion } from "@/hooks/useNotedVersions"

interface NotedVersionHistoryProps {
  pageId: string
  currentContent: string
  onRestore: (restoredPage: { title: string; content: string }) => void
  onClose: () => void
}

function stripHtml(html: string): string {
  return html.replaceAll(/<[^>]*>/g, "")
}

type DiffLineType = "same" | "added" | "removed"
type DiffLine = { type: DiffLineType; text: string }

function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const result: DiffLine[] = []

  // Simple LCS-based diff
  const lcs: number[][] = Array.from({ length: oldLines.length + 1 }, () =>
    new Array(newLines.length + 1).fill(0)
  )
  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  let i = oldLines.length
  let j = newLines.length
  const stack: { type: "same" | "added" | "removed"; text: string }[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "same", text: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      stack.push({ type: "added", text: newLines[j - 1] })
      j--
    } else {
      stack.push({ type: "removed", text: oldLines[i - 1] })
      i--
    }
  }

  stack.reverse()
  result.push(...stack)
  return result
}

export function NotedVersionHistory({
  pageId,
  currentContent,
  onRestore,
  onClose,
}: Readonly<NotedVersionHistoryProps>) {
  const { versions, loading, fetchVersions, fetchVersion, restoreVersion } = useNotedVersions(pageId)
  const [selectedVersion, setSelectedVersion] = useState<NotedPageVersion | null>(null)
  const [versionContent, setVersionContent] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  const handleSelectVersion = useCallback(async (version: NotedPageVersion) => {
    setSelectedVersion(version)
    const full = await fetchVersion(version.id)
    if (full) {
      setVersionContent(full.content || "")
    }
  }, [fetchVersion])

  const handleRestore = useCallback(async () => {
    if (!selectedVersion) return
    const restored = await restoreVersion(selectedVersion.id)
    if (restored) {
      onRestore({ title: restored.title, content: restored.content })
    }
    setConfirmRestore(false)
  }, [selectedVersion, restoreVersion, onRestore])

  const diffResult = showDiff && versionContent !== null
    ? diffLines(stripHtml(versionContent), stripHtml(currentContent))
    : null

  return (
    <div className="flex flex-col h-full border-l">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Version History</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Version list */}
        <div className="w-56 shrink-0 border-r">
          <ScrollArea className="h-full">
            {loading && (
              <div className="p-4 text-xs text-muted-foreground text-center">Loading...</div>
            )}
            {!loading && versions.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground text-center">
                <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No versions saved yet. Save a version to start tracking changes.
              </div>
            )}
            {!loading && versions.length > 0 && (
              <div className="py-1">
                {versions.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => handleSelectVersion(v)}
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-muted transition-colors",
                      selectedVersion?.id === v.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        v{v.version_number}
                      </Badge>
                      <span className="text-xs truncate">{v.title || "Untitled"}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {new Date(v.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Version preview / diff */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedVersion && versionContent !== null ? (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-xs font-medium">
                  Version {selectedVersion.version_number}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant={showDiff ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setShowDiff(!showDiff)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {showDiff ? "Preview" : "Diff"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setConfirmRestore(true)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 p-3">
                {showDiff && diffResult ? (
                  <div className="font-mono text-xs space-y-0">
                    {diffResult.map((line, i) => (
                      <div
                        key={`${line.type}-${i}`}
                        className={cn(
                          "px-2 py-0.5 whitespace-pre-wrap",
                          line.type === "added" && "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
                          line.type === "removed" && "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through",
                          line.type === "same" && "text-muted-foreground"
                        )}
                      >
                        <span className="select-none mr-2 text-muted-foreground/50">
                          {{ added: "+", removed: "-" }[line.type] ?? " "}
                        </span>
                        {line.text || "\u00A0"}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: versionContent }}
                  />
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <History className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-xs text-muted-foreground">
                Select a version to preview or compare
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Restore confirmation */}
      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {selectedVersion?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The current content will be saved as a new version before restoring.
              You can always switch back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
