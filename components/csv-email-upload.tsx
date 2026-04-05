"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, Check, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CsvEmailUploadProps {
  onEmailsUploaded: (emails: Array<{ email: string; name?: string }>) => void
  className?: string
}

interface UploadResult {
  success: boolean
  added: number
  skipped: number
  message?: string
  error?: string
}

export function CsvEmailUpload({ onEmailsUploaded, className }: Readonly<CsvEmailUploadProps>) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File) => {
    setIsProcessing(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/saved-emails/bulk", {
        method: "POST",
        headers: {
          "x-upload-type": "csv-file",
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      setUploadResult({
        success: true,
        added: result.added || 0,
        skipped: result.skipped || 0,
        message: result.message,
      })

      if (result.added > 0) {
        onEmailsUploaded([])
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload CSV file"

      setUploadResult({
        success: false,
        added: 0,
        skipped: 0,
        error: errorMessage,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      const error = "Please select a CSV file (.csv extension required)"
      setUploadResult({
        success: false,
        added: 0,
        skipped: 0,
        error,
      })
      return
    }

    if (file.size > 1024 * 1024) {
      const error = "File size must be less than 1MB"
      setUploadResult({
        success: false,
        added: 0,
        skipped: 0,
        error,
      })
      return
    }

    if (file.size === 0) {
      const error = "CSV file cannot be empty"
      setUploadResult({
        success: false,
        added: 0,
        skipped: 0,
        error,
      })
      return
    }

    processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const resetUpload = () => {
    setUploadResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Email List
        </CardTitle>
        <CardDescription>
          Upload a CSV file with email addresses. Simple format: one email per line, or email,name format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!uploadResult && (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">Drag and drop your CSV file here, or click to browse</p>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Choose File"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>• Simple format: one email per line</p>
              <p>• Or CSV format: email,name (name optional)</p>
              <p>• Maximum file size: 1MB</p>
              <p>• Example: john@example.com or john@example.com,John Doe</p>
            </div>
          </>
        )}

        {uploadResult && (
          <div className="space-y-4">
            {uploadResult.success ? (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  {uploadResult.added > 0 && `Successfully added ${uploadResult.added} email${uploadResult.added !== 1 ? "s" : ""}`}
                  {uploadResult.added === 0 && "Upload completed"}
                  {uploadResult.skipped > 0 && ` (${uploadResult.skipped} duplicates skipped)`}
                  {uploadResult.message && `. ${uploadResult.message}`}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {uploadResult.error || "Failed to process the CSV file. Please check the format and try again."}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button onClick={resetUpload} variant="outline">
                Upload Another File
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
