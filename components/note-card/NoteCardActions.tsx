"use client"

import type React from "react"
import { NoteActionsBase, type NoteActionsBaseProps } from "@/components/shared/NoteActionsBase"

export type NoteCardActionsProps = Omit<NoteActionsBaseProps, "showEditActionsAlways">

export const NoteCardActions: React.FC<NoteCardActionsProps> = (props) => {
  return <NoteActionsBase {...props} />
}
