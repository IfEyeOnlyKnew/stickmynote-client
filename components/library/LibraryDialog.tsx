"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LibraryPanel } from "./LibraryPanel"

type LibraryScopeType = "concur_user" | "alliance_pad" | "inference_pad"

interface LibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scopeType: LibraryScopeType
  scopeId: string
  title?: string
}

export function LibraryDialog({ open, onOpenChange, scopeType, scopeId, title }: Readonly<LibraryDialogProps>) {
  const defaultTitle =
    scopeType === "concur_user"
      ? "My Library"
      : scopeType === "alliance_pad"
        ? "Pad Library"
        : "Hub Library"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || defaultTitle}</DialogTitle>
        </DialogHeader>
        <LibraryPanel scopeType={scopeType} scopeId={scopeId} />
      </DialogContent>
    </Dialog>
  )
}
