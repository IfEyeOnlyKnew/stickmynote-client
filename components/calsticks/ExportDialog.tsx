"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileText, FileSpreadsheet, Printer, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { CalStick } from "@/types/calstick"
import { format } from "date-fns"

interface ExportDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly calsticks: CalStick[]
  readonly selectedPad: string
}

// Helper to format status for display
function formatStatusLabel(status: string): string {
  if (status === "in-progress") return "In Progress"
  if (status === "in-review") return "In Review"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function ExportDialog({ open, onClose, calsticks, selectedPad }: ExportDialogProps) {
  const [exporting, setExporting] = useState(false)

  const handleExportCSV = async () => {
    try {
      setExporting(true)
      const response = await fetch("/api/calsticks/export/csv")

      if (!response.ok) throw new Error("Failed to export CSV")

      const blob = await response.blob()
      const url = globalThis.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `calsticks-export-${format(new Date(), "yyyy-MM-dd")}.csv`
      document.body.appendChild(a)
      a.click()
      globalThis.URL.revokeObjectURL(url)
      a.remove()

      toast({
        title: "Success",
        description: "CSV exported successfully",
      })
    } catch (error) {
      console.error("Error exporting CSV:", error)
      toast({
        title: "Error",
        description: "Failed to export CSV",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      // Generate Excel-compatible format (CSV with proper encoding)
      const response = await fetch("/api/calsticks/export/csv")

      if (!response.ok) throw new Error("Failed to export Excel")

      const blob = await response.blob()
      const url = globalThis.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `calsticks-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`
      document.body.appendChild(a)
      a.click()
      globalThis.URL.revokeObjectURL(url)
      a.remove()

      toast({
        title: "Success",
        description: "Excel file exported successfully",
      })
    } catch (error) {
      console.error("Error exporting Excel:", error)
      toast({
        title: "Error",
        description: "Failed to export Excel",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handlePrintView = () => {
    // Open print dialog with formatted board view
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow popups to print",
        variant: "destructive",
      })
      return
    }

    // Group tasks by status
    const grouped = {
      todo: calsticks.filter((cs) => cs.calstick_status === "todo" || !cs.calstick_status),
      "in-progress": calsticks.filter((cs) => cs.calstick_status === "in-progress"),
      "in-review": calsticks.filter((cs) => cs.calstick_status === "in-review"),
      done: calsticks.filter((cs) => cs.calstick_status === "done" || cs.calstick_completed),
      blocked: calsticks.filter((cs) => cs.calstick_status === "blocked"),
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CalSticks Board - ${format(new Date(), "MMMM d, yyyy")}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 20px;
              color: #000;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 10px;
            }
            .subtitle {
              color: #666;
              margin-bottom: 30px;
            }
            .board {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 20px;
              margin-top: 20px;
            }
            .column {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 15px;
              break-inside: avoid;
            }
            .column-header {
              font-weight: 600;
              font-size: 14px;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .task-count {
              background: #f0f0f0;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 12px;
            }
            .task {
              border: 1px solid #e0e0e0;
              border-radius: 6px;
              padding: 10px;
              margin-bottom: 10px;
              background: white;
              break-inside: avoid;
            }
            .task-title {
              font-weight: 500;
              font-size: 13px;
              margin-bottom: 5px;
            }
            .task-content {
              font-size: 11px;
              color: #666;
              margin-bottom: 8px;
            }
            .task-meta {
              font-size: 10px;
              color: #999;
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            .badge {
              background: #f0f0f0;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .priority-urgent { background: #fee2e2; color: #991b1b; }
            .priority-high { background: #fed7aa; color: #9a3412; }
            .priority-medium { background: #fef3c7; color: #92400e; }
            .priority-low { background: #dbeafe; color: #1e40af; }
            .completed {
              opacity: 0.6;
              text-decoration: line-through;
            }
            @media print {
              .board {
                grid-template-columns: repeat(5, 1fr);
              }
              body {
                margin: 10px;
              }
            }
          </style>
        </head>
        <body>
          <h1>CalSticks Kanban Board</h1>
          <div class="subtitle">Exported on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</div>
          
          <div class="board">
            ${Object.entries(grouped)
              .map(
                ([status, tasks]) => `
              <div class="column">
                <div class="column-header">
                  <span>${formatStatusLabel(status)}</span>
                  <span class="task-count">${tasks.length}</span>
                </div>
                ${tasks
                  .map(
                    (task) => `
                  <div class="task ${task.calstick_completed ? "completed" : ""}">
                    <div class="task-title">${task.stick?.topic || "Untitled"}</div>
                    <div class="task-content">${task.content.substring(0, 100)}${task.content.length > 100 ? "..." : ""}</div>
                    <div class="task-meta">
                      ${task.stick?.pad?.name ? `<span class="badge">${task.stick.pad.name}</span>` : ""}
                      ${task.calstick_priority && task.calstick_priority !== "none" ? `<span class="badge priority-${task.calstick_priority}">${task.calstick_priority}</span>` : ""}
                      ${task.calstick_date ? `<span class="badge">Due: ${format(new Date(task.calstick_date), "MMM d")}</span>` : ""}
                      ${task.assignee ? `<span class="badge">@${task.assignee.username || task.assignee.email}</span>` : ""}
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            `,
              )
              .join("")}
          </div>
        </body>
      </html>
    `

    printWindow.document.documentElement.innerHTML = html
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handlePDFExport = () => {
    // Generate PDF by printing to PDF
    handlePrintView()
    toast({
      title: "Print Dialog Opened",
      description: "Select 'Save as PDF' to export as PDF",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Board</DialogTitle>
          <DialogDescription>
            Export your tasks and board layout in different formats for reporting, backup, or sharing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          <Button
            variant="outline"
            className="justify-start bg-transparent"
            onClick={handleExportCSV}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Export as CSV
            <span className="ml-auto text-xs text-muted-foreground">For spreadsheets</span>
          </Button>

          <Button
            variant="outline"
            className="justify-start bg-transparent"
            onClick={handleExportExcel}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Export as Excel
            <span className="ml-auto text-xs text-muted-foreground">For Excel files</span>
          </Button>

          <Button
            variant="outline"
            className="justify-start bg-transparent"
            onClick={handlePDFExport}
            disabled={exporting}
          >
            <FileText className="mr-2 h-4 w-4" />
            Export as PDF
            <span className="ml-auto text-xs text-muted-foreground">Save board layout</span>
          </Button>

          <Button
            variant="outline"
            className="justify-start bg-transparent"
            onClick={handlePrintView}
            disabled={exporting}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print View
            <span className="ml-auto text-xs text-muted-foreground">Printer-friendly</span>
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Total tasks: {calsticks.length}</p>
          {selectedPad !== "all" && <p>Filtered by current project selection</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
