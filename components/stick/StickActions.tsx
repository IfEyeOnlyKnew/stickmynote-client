"use client"

import { Button } from "@/components/ui/button"

interface StickActionsProps {
  isNew: boolean
  isEditing: boolean
  hasChanges: boolean
  isSaving: boolean
  canEdit: boolean
  contentTrimmed: boolean
  onCancelNew: () => void
  onStickNew: () => void
  onCancelEdit: () => void
  onStickEdit: () => void
}

export function StickActions({
  isNew,
  isEditing,
  hasChanges,
  isSaving,
  canEdit,
  contentTrimmed,
  onCancelNew,
  onStickNew,
  onCancelEdit,
  onStickEdit,
}: Readonly<StickActionsProps>) {
  if (!canEdit) return null

  if (isNew) {
    return (
      <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-gray-200">
        <Button variant="outline" size="sm" onClick={onCancelNew} className="text-xs bg-transparent">
          Cancel
        </Button>
        <Button size="sm" onClick={onStickNew} disabled={!hasChanges} className="text-xs">
          Stick
        </Button>
      </div>
    )
  }

  if (!isNew && isEditing && hasChanges) {
    return (
      <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-gray-200">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancelEdit}
          disabled={isSaving}
          className="text-xs bg-transparent"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onStickEdit}
          disabled={!hasChanges || isSaving || !contentTrimmed}
          className="text-xs"
        >
          {isSaving ? (
            <>
              <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            "Stick"
          )}
        </Button>
      </div>
    )
  }

  return null
}
