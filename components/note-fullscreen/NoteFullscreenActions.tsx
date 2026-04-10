"use client"

import type React from "react"
import { NoteActionsBase, type NoteActionsBaseProps } from "@/components/shared/NoteActionsBase"

export type NoteFullscreenActionsProps = Omit<NoteActionsBaseProps, "showEditActionsAlways">

export const NoteFullscreenActions: React.FC<NoteFullscreenActionsProps> = (props) => {
  return <NoteActionsBase {...props} showEditActionsAlways={true} />
}
