"use client"

import { Button } from "@/components/ui/button"

interface StickHeaderProps {
  isNew: boolean
  isEditing: boolean
  hasChanges: boolean
  isSaving: boolean
  onCancelNew: () => void
  onStickNew: () => void
  onCancelEdit: () => void
  onStickEdit: () => void
}

export function StickHeader({
  isNew,
  isEditing,
  hasChanges,
  isSaving,
  onCancelNew,
  onStickNew,
  onCancelEdit,
  onStickEdit,
}: Readonly<StickHeaderProps>) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {isNew && <span className="text-sm text-blue-600">(unsaved)</span>}
        {!isNew && isEditing && <span className="text-sm text-orange-600">(editing)</span>}
      </div>
      <div className="flex items-center gap-2">
        {isNew && (
          <>
            <Button variant="outline" onClick={onCancelNew} size="sm">
              Cancel
            </Button>
            <Button onClick={onStickNew} disabled={!hasChanges} size="sm">
              Stick
            </Button>
          </>
        )}
        {!isNew && isEditing && hasChanges && (
          <>
            <Button variant="outline" onClick={onCancelEdit} size="sm" disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={onStickEdit} disabled={!hasChanges || isSaving} size="sm">
              {isSaving ? (
                <>
                  <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                "Stick"
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
