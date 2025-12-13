"use client"

import { useEffect, useRef, useState } from "react"
import { DraftStorage } from "@/lib/draft-storage"

interface UseAutoSaveDraftOptions {
  padId: string
  topic: string
  content: string
  enabled?: boolean
  autoSaveDelay?: number // milliseconds
}

export function useAutoSaveDraft({
  padId,
  topic,
  content,
  enabled = true,
  autoSaveDelay = 2000,
}: UseAutoSaveDraftOptions) {
  const [draftId, setDraftId] = useState<string>("")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-save effect
  useEffect(() => {
    if (!enabled || (!topic.trim() && !content.trim())) {
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      setIsSaving(true)

      if (draftId) {
        // Update existing draft
        DraftStorage.updateDraft(draftId, topic, content)
      } else {
        // Create new draft
        const newDraftId = DraftStorage.saveDraft(padId, topic, content)
        setDraftId(newDraftId)
      }

      setLastSaved(new Date())
      setIsSaving(false)
    }, autoSaveDelay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [padId, topic, content, enabled, autoSaveDelay, draftId])

  const deleteDraft = () => {
    if (draftId) {
      DraftStorage.deleteDraft(draftId)
      setDraftId("")
      setLastSaved(null)
    }
  }

  const loadDraft = (loadDraftId: string) => {
    const draft = DraftStorage.getDraft(loadDraftId)
    if (draft) {
      setDraftId(loadDraftId)
      setLastSaved(new Date(draft.lastSaved))
      return draft
    }
    return null
  }

  return {
    draftId,
    lastSaved,
    isSaving,
    deleteDraft,
    loadDraft,
  }
}
