"use client"

import { useState, useEffect, memo } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Download, Trash2, X, Save, Sparkles } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { NoteTab } from "@/types/note"
import type { StickTab } from "@/types/pad"
import type { NoteTabsConfig } from "@/types/note-tabs-config"
import { CollaborativeRichTextEditor } from "@/components/rich-text/CollaborativeRichTextEditorDynamic"

// CollaborativeRichTextModal uses Tiptap which requires client-side only rendering
const CollaborativeRichTextModal = dynamic(
  () => import("@/components/rich-text/CollaborativeRichTextModal").then((mod) => mod.CollaborativeRichTextModal),
  { ssr: false }
)

type TabWithData = NoteTab | StickTab

interface DetailsTabContentProps {
  noteId: string
  details: string
  noteTabs: TabWithData[]
  readOnly?: boolean
  config: NoteTabsConfig
  onDetailsChange: (value: string) => Promise<void> | void
  onRefreshTabs: () => void
  enableCollaboration?: boolean
}

export const DetailsTabContent = memo(function DetailsTabContent({
  noteId,
  details,
  noteTabs,
  readOnly = false,
  config,
  onDetailsChange,
  onRefreshTabs,
  enableCollaboration = true,
}: DetailsTabContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [localDetails, setLocalDetails] = useState(details)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setLocalDetails(details)
    setHasUnsavedChanges(false)
  }, [details])

  const handleDetailsChange = (newDetails: string) => {
    setLocalDetails(newDetails)
    setHasUnsavedChanges(newDetails !== details)
  }

  const handleStickChanges = async () => {
    setIsSaving(true)
    try {
      await onDetailsChange(localDetails)
      setHasUnsavedChanges(false)

      await new Promise((resolve) => setTimeout(resolve, 500))
      onRefreshTabs()

      toast({
        title: "Details saved",
        description: "Additional details have been saved successfully.",
      })
    } catch (error) {
      console.error("Error saving details:", error)
      toast({
        title: "Error",
        description: "Failed to save details. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelChanges = () => {
    setLocalDetails(details)
    setHasUnsavedChanges(false)
    setEditorKey((prev) => prev + 1)
    toast({
      title: "Changes cancelled",
      description: "Unsaved changes have been discarded.",
    })
  }

  const handleExpandClick = () => {
    setIsModalOpen(true)
  }

  const handleModalSave = async (content: string) => {
    setIsSaving(true)
    try {
      await onDetailsChange(content)
      setHasUnsavedChanges(false)
      setIsModalOpen(false)

      await new Promise((resolve) => setTimeout(resolve, 500))
      onRefreshTabs()

      toast({
        title: "Details saved",
        description: "Additional details have been saved successfully.",
      })
    } catch (error) {
      console.error("Error saving details:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save details file.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleModalContentChange = (newContent: string) => {
    setLocalDetails(newContent)
    setHasUnsavedChanges(newContent !== details)
  }

  const detailsTab = noteTabs.find((tab) => tab.tab_type === "details")
  const exportLinks = detailsTab?.tab_data?.exports || []
  const aiAnswers = detailsTab?.tab_data?.ai_answers || []

  return (
    <div className="space-y-4">
      <div>
        <span className="text-sm font-medium text-gray-700 mb-2 block">Additional Details</span>
        <CollaborativeRichTextEditor
          key={editorKey}
          documentId={`${noteId}-details`}
          content={localDetails}
          onChange={handleDetailsChange}
          placeholder="Add any additional details, notes, or metadata..."
          readOnly={readOnly}
          maxLength={50000}
          onExpandClick={handleExpandClick}
          enableCollaboration={false}
        />
        {/* </CHANGE> */}

        {hasUnsavedChanges && !readOnly && !isModalOpen && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-md bg-blue-50 border border-blue-200">
            <div className="flex-1 text-sm text-gray-700">You have unsaved changes to the additional details.</div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelChanges}
              disabled={isSaving}
              className="text-gray-600 hover:text-gray-700 bg-transparent"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleStickChanges}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Saving..." : "Stick"}
            </Button>
          </div>
        )}
      </div>

      <CollaborativeRichTextModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
        }}
        title="Additional Details - Expanded Editor"
        documentId={`${noteId}-details`}
        content={localDetails}
        onChange={handleModalContentChange}
        onSave={handleModalSave}
        readOnly={readOnly}
        maxLength={50000}
        enableCollaboration={false}
      />

      {exportLinks.length > 0 ? (
        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700 block">Export Links</span>
          <div className="space-y-2">
            {exportLinks.map((exportLink: any) => (
              <div
                key={`${exportLink.type}-${exportLink.created_at}`}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {(() => {
                      if (exportLink.type === "link_summary") return "Link Summary Report"
                      if (exportLink.type === "chat_export") return "Chat Conversation Export"
                      if (exportLink.type === "reply-summary") return "Stick Replies Export"
                      if (exportLink.type?.startsWith("reply-summary-")) {
                        const suffix = exportLink.type.replace("reply-summary-", "")
                        return `${suffix.charAt(0).toUpperCase() + suffix.slice(1)} Stick Replies Export`
                      }
                      return "Complete Note Export"
                    })()}
                  </div>
                  <div className="text-xs text-gray-500">
                    Generated on {new Date(exportLink.created_at).toLocaleDateString()} at{" "}
                    {new Date(exportLink.created_at).toLocaleTimeString()}
                  </div>
                  {exportLink.filename && (
                    <div className="text-xs text-gray-400 mt-1">{exportLink.filename}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(exportLink.url, "_blank")}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  {!readOnly && config.supportsExportDeletion && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!globalThis.confirm("Delete this export file? This action cannot be undone.")) return

                        try {
                          const response = await fetch("/api/delete-export", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              noteId: noteId,
                              exportUrl: exportLink.url,
                              isTeamNote: config.isTeamNote || false,
                              isStick: config.isStick || false,
                            }),
                          })

                          if (!response.ok) {
                            const errorData = await response.json()
                            throw new Error(errorData.error || "Failed to delete export")
                          }

                          await new Promise((resolve) => setTimeout(resolve, 500))
                          onRefreshTabs()

                          toast({
                            title: "Export deleted",
                            description: "Export file has been permanently deleted.",
                          })
                        } catch (error) {
                          console.error("Error deleting export:", error)
                          toast({
                            title: "Error",
                            description: error instanceof Error ? error.message : "Failed to delete export file.",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          No export links available. Use the Export button to create downloadable exports.
        </div>
      )}

      {/* AI Answers Section */}
      {aiAnswers.length > 0 && (
        <div className="space-y-2 mt-4">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Saved AI Answers
          </span>
          <div className="space-y-3">
            {aiAnswers.map((aiAnswer: any) => (
              <div
                key={`ai-answer-${aiAnswer.created_at}`}
                className="p-3 bg-purple-50 border border-purple-200 rounded-md"
              >
                <div className="text-xs text-purple-600 font-medium mb-1">Question:</div>
                <div className="text-sm text-gray-800 mb-2">{aiAnswer.question}</div>
                <div className="text-xs text-purple-600 font-medium mb-1">Answer:</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{aiAnswer.answer}</div>
                <div className="text-xs text-gray-400 mt-2">
                  Saved on {new Date(aiAnswer.created_at).toLocaleDateString()} at{" "}
                  {new Date(aiAnswer.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
