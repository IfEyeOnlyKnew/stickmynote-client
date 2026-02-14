"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { FullscreenItem } from "@/hooks/useFullscreen"

interface UnifiedFullscreenProps<T extends FullscreenItem> {
  item: T
  mode: "note" | "team-note" | "panel" | "stick" // Added "stick" mode support
  readOnly?: boolean
  onClose: () => void
  children?: ReactNode
}

export function UnifiedFullscreen<T extends FullscreenItem>({
  item,
  mode,
  readOnly = false,
  onClose,
  children,
}: Readonly<UnifiedFullscreenProps<T>>) {
  const getTitle = () => {
    if (mode === "panel") return item.topic || "Community Note"
    if (mode === "stick") return item.topic || "Untitled Stick" // Added stick mode title handling
    return item.topic || "Untitled Note"
  }

  const getSubtitle = () => {
    if (item.isNew) return "(unsaved)"
    return null
  }

  return (
    <dialog
      open
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-8 w-full h-full m-0 max-w-none max-h-none border-none"
    >
      <div className="w-full max-w-6xl mx-auto">
        <div className="w-full rounded-lg shadow-md border overflow-hidden bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/80 border-b">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {getTitle()}
                {getSubtitle() && <span className="text-sm text-blue-600 ml-2">{getSubtitle()}</span>}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} title="Close fullscreen">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 bg-transparent text-gray-900">{children}</div>
        </div>
      </div>
    </dialog>
  )
}
