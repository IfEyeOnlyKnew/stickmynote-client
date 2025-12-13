// Client-side draft storage using localStorage
export interface StickDraft {
  id: string
  padId: string
  topic: string
  content: string
  lastSaved: string
  createdAt: string
}

const DRAFT_KEY_PREFIX = "stick_draft_"
const DRAFT_LIST_KEY = "stick_drafts_list"

export class DraftStorage {
  static saveDraft(padId: string, topic: string, content: string): string {
    // Don't save empty drafts
    if (!topic.trim() && !content.trim()) {
      return ""
    }

    const draftId = `${padId}_${Date.now()}`
    const draft: StickDraft = {
      id: draftId,
      padId,
      topic,
      content,
      lastSaved: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(`${DRAFT_KEY_PREFIX}${draftId}`, JSON.stringify(draft))

      // Update draft list
      const draftsList = this.getDraftsList()
      if (!draftsList.includes(draftId)) {
        draftsList.push(draftId)
        localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(draftsList))
      }

      return draftId
    } catch (error) {
      console.error("Error saving draft:", error)
      return ""
    }
  }

  static updateDraft(draftId: string, topic: string, content: string): boolean {
    try {
      const existingDraft = this.getDraft(draftId)
      if (!existingDraft) return false

      const updatedDraft: StickDraft = {
        ...existingDraft,
        topic,
        content,
        lastSaved: new Date().toISOString(),
      }

      localStorage.setItem(`${DRAFT_KEY_PREFIX}${draftId}`, JSON.stringify(updatedDraft))
      return true
    } catch (error) {
      console.error("Error updating draft:", error)
      return false
    }
  }

  static getDraft(draftId: string): StickDraft | null {
    try {
      const draftStr = localStorage.getItem(`${DRAFT_KEY_PREFIX}${draftId}`)
      if (!draftStr) return null
      return JSON.parse(draftStr) as StickDraft
    } catch (error) {
      console.error("Error getting draft:", error)
      return null
    }
  }

  static getDraftsForPad(padId: string): StickDraft[] {
    try {
      const draftsList = this.getDraftsList()
      const drafts: StickDraft[] = []

      for (const draftId of draftsList) {
        const draft = this.getDraft(draftId)
        if (draft && draft.padId === padId) {
          drafts.push(draft)
        }
      }

      // Sort by last saved, most recent first
      return drafts.sort((a, b) => new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime())
    } catch (error) {
      console.error("Error getting drafts for pad:", error)
      return []
    }
  }

  static getAllDrafts(): StickDraft[] {
    try {
      const draftsList = this.getDraftsList()
      const drafts: StickDraft[] = []

      for (const draftId of draftsList) {
        const draft = this.getDraft(draftId)
        if (draft) {
          drafts.push(draft)
        }
      }

      // Sort by last saved, most recent first
      return drafts.sort((a, b) => new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime())
    } catch (error) {
      console.error("Error getting all drafts:", error)
      return []
    }
  }

  static deleteDraft(draftId: string): boolean {
    try {
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${draftId}`)

      // Update draft list
      const draftsList = this.getDraftsList()
      const updatedList = draftsList.filter((id) => id !== draftId)
      localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(updatedList))

      return true
    } catch (error) {
      console.error("Error deleting draft:", error)
      return false
    }
  }

  static clearAllDrafts(): boolean {
    try {
      const draftsList = this.getDraftsList()

      for (const draftId of draftsList) {
        localStorage.removeItem(`${DRAFT_KEY_PREFIX}${draftId}`)
      }

      localStorage.removeItem(DRAFT_LIST_KEY)
      return true
    } catch (error) {
      console.error("Error clearing all drafts:", error)
      return false
    }
  }

  private static getDraftsList(): string[] {
    try {
      const listStr = localStorage.getItem(DRAFT_LIST_KEY)
      if (!listStr) return []
      return JSON.parse(listStr) as string[]
    } catch (error) {
      console.error("Error getting drafts list:", error)
      return []
    }
  }
}
