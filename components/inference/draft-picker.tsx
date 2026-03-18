"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DraftStorage, type StickDraft } from "@/lib/draft-storage"
import { FileText, Trash2, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface DraftPickerProps {
  padId: string
  onDraftSelect: (draft: StickDraft) => void
}

export function DraftPicker({ padId, onDraftSelect }: DraftPickerProps) {
  const [drafts, setDrafts] = useState<StickDraft[]>([])
  const [open, setOpen] = useState(false)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open) {
      loadDrafts()
    }
  }, [open, padId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const loadDrafts = () => {
    const padDrafts = DraftStorage.getDraftsForPad(padId)
    setDrafts(padDrafts)
  }

  const handleSelectDraft = (draft: StickDraft) => {
    onDraftSelect(draft)
    setOpen(false)
  }

  const handleDeleteDraft = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation()
    if (confirm("Are you sure you want to delete this draft?")) {
      DraftStorage.deleteDraft(draftId)
      loadDrafts()
    }
  }

  if (drafts.length === 0 && !open) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Drafts
          {drafts.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {drafts.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saved Drafts</DialogTitle>
          <DialogDescription>Load a previously saved draft to continue editing</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {drafts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No drafts saved yet</p>
              </CardContent>
            </Card>
          ) : (
            drafts.map((draft) => (
              <Card
                key={draft.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSelectDraft(draft)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-1">{draft.topic || "Untitled Draft"}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteDraft(e, draft.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">{draft.content}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Saved {formatDistanceToNow(new Date(draft.lastSaved), { addSuffix: true })}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {draft.content.length} characters
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
