"use client"

import type React from "react"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download, Info, ClipboardPaste } from "lucide-react"

interface CSVImportDialogProps {
  organizationId: string
  onImportComplete?: () => void
}

interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export function CSVImportDialog({ organizationId, onImportComplete }: Readonly<CSVImportDialogProps>) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [activeTab, setActiveTab] = useState<string>("paste")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv"))) {
      setFile(selectedFile)
      setResult(null)
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      })
    }
  }

  const parseMembers = (text: string): { email: string; name?: string }[] => {
    const lines = text.split("\n").filter((line) => line.trim())

    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes("email") ? 1 : 0
    const members: { email: string; name?: string }[] = []

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Handle CSV format: email, name
      const parts = line.split(",")
      const email = parts[0].trim().replaceAll(/^["']|["']$/g, "") // Remove quotes
      const name = parts[1]?.trim().replaceAll(/^["']|["']$/g, "") || undefined

      if (email?.includes("@")) {
        members.push({ email, name })
      }
    }

    return members
  }

  const handleImport = async () => {
    let textToProcess = ""
    if (activeTab === "paste") {
      textToProcess = pastedText
    } else if (file) {
      textToProcess = await file.text()
    }

    if (!textToProcess.trim()) {
      toast({
        title: "No Data",
        description: activeTab === "paste" ? "Please paste member data" : "Please select a file",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const members = parseMembers(textToProcess)

      if (members.length === 0) {
        throw new Error("No valid email addresses found")
      }

      console.log("[v0] CSV Import: Sending", members.length, "members to API")

      const response = await fetch(`/api/organizations/${organizationId}/members/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      })

      console.log("[v0] CSV Import: Response status", response.status)

      const data = await response.json()

      console.log("[v0] CSV Import: Response data", data)

      if (!response.ok) {
        throw new Error(data.error || "Import failed")
      }

      setResult(data)

      if (data.success > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully pre-registered ${data.success} member(s)`,
        })
        onImportComplete?.()
      }
    } catch (error) {
      console.error("[v0] CSV Import error:", error)
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import members",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = "email,name\nalice.smith@company.com,Alice Smith\nbob.jones@company.com,Bob Jones\n"
    const blob = new Blob([template], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "member-import-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const resetDialog = () => {
    setFile(null)
    setPastedText("")
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const hasData = activeTab === "paste" ? pastedText.trim().length > 0 : !!file

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) resetDialog()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import Members
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pre-Register Members</DialogTitle>
          <DialogDescription>
            Add email addresses and names to pre-register members. Format: email, name (one per line).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste">
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Paste
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-3">
              <Textarea
                placeholder="bob.smith@magna.com, Bob Smith
carol.davis@magna.com, Carol Davis
david.wilson@magna.com, David Wilson"
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value)
                  setResult(null)
                }}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">One member per line: email, name</p>
            </TabsContent>

            <TabsContent value="upload" className="space-y-3">
              <Button variant="ghost" size="sm" onClick={downloadTemplate} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>

              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" aria-label="Upload CSV file" />
              <button
                type="button"
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">CSV files only</p>
                  </>
                )}
              </button>
            </TabsContent>
          </Tabs>

          {result && (
            <div className="space-y-2">
              {result.success > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>Successfully pre-registered {result.success} member(s)</AlertDescription>
                </Alert>
              )}
              {result.failed > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to pre-register {result.failed} member(s)
                    {result.errors.length > 0 && (
                      <ul className="mt-2 text-xs list-disc list-inside">
                        {result.errors.slice(0, 5).map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                        {result.errors.length > 5 && <li>...and {result.errors.length - 5} more</li>}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={!hasData || loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Pre-Register"
                )}
              </Button>
            )}
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">How Pre-Registration Works</p>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Imported emails are added to the approved list</li>
                  <li>No invitation emails are sent</li>
                  <li>Users gain access when they sign up with a pre-registered email</li>
                  <li>All pre-registered users start with basic &quot;viewer&quot; access</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
