"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LibraryPanel } from "./LibraryPanel"

type StickType = "personal" | "concur" | "alliance" | "inference"

interface LibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  stickType: StickType
  title?: string
}

export function LibraryDialog({ open, onOpenChange, stickId, stickType, title }: Readonly<LibraryDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "Files"}</DialogTitle>
        </DialogHeader>
        <LibraryPanel stickId={stickId} stickType={stickType} />
      </DialogContent>
    </Dialog>
  )
}
