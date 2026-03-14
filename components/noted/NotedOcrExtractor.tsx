"use client"

import { useState, useCallback, useRef } from "react"
import { Image as ImageIcon, Upload, Loader2, Copy, Check, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface NotedOcrExtractorProps {
  open: boolean
  onClose: () => void
  onInsert: (text: string) => void
}

export function NotedOcrExtractor({ open, onClose, onInsert }: NotedOcrExtractorProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState("")
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)

    // OCR
    try {
      setProcessing(true)
      setProgress(0)
      setExtractedText("")

      const { createWorker } = await import("tesseract.js")
      const worker = await createWorker("eng", undefined, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      const { data } = await worker.recognize(file)
      setExtractedText(data.text)
      await worker.terminate()
    } catch (err) {
      console.error("OCR failed:", err)
      setExtractedText("[OCR extraction failed. Please try a clearer image.]")
    } finally {
      setProcessing(false)
    }
  }, [])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          const fakeEvent = {
            target: { files: [file] },
          } as unknown as React.ChangeEvent<HTMLInputElement>
          handleFileSelect(fakeEvent)
        }
        break
      }
    }
  }, [handleFileSelect])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(extractedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [extractedText])

  const handleInsert = useCallback(() => {
    if (extractedText.trim()) {
      onInsert(extractedText.trim())
    }
    onClose()
  }, [extractedText, onInsert, onClose])

  const handleClose = useCallback(() => {
    setImagePreview(null)
    setExtractedText("")
    setProgress(0)
    onClose()
  }, [onClose])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-xl" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle>Extract Text from Image (OCR)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Upload area */}
          {!imagePreview && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                Click to upload an image, or paste from clipboard
              </p>
              <p className="text-xs text-muted-foreground/70">
                Supports PNG, JPG, BMP, TIFF
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              <img
                src={imagePreview}
                alt="Upload preview"
                className="max-h-48 mx-auto object-contain"
              />
            </div>
          )}

          {/* Progress */}
          {processing && (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
          )}

          {/* Extracted text */}
          {extractedText && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Extracted Text</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] gap-1"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                rows={6}
                className="text-sm font-mono"
              />
            </div>
          )}

          {/* Upload another */}
          {imagePreview && !processing && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                setImagePreview(null)
                setExtractedText("")
                fileInputRef.current?.click()
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Another Image
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!extractedText.trim()}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            Insert Text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
