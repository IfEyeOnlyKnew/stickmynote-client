"use client"

import { useMemo, useState, useEffect } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Video,
  Monitor,
  Calendar,
  CalendarDays,
  FileText,
  Phone,
  Users,
} from "lucide-react"
import { useCommunicationPaletteContext } from "./communication-palette-provider"
import type { CommunicationAction } from "@/types/meeting"

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CommunicationActionItem {
  id: CommunicationAction
  label: string
  description: string
  icon: React.ReactNode
  keywords: string[]
  group: "Communication" | "Calendar"
}

// ----------------------------------------------------------------------------
// Action Definitions
// ----------------------------------------------------------------------------

const COMMUNICATION_ACTIONS: CommunicationActionItem[] = [
  {
    id: "quick-call",
    label: "Quick Call",
    description: "Start an instant video or audio call",
    icon: <Video className="mr-2 h-4 w-4 text-blue-500" />,
    keywords: ["video", "call", "meeting", "join", "start"],
    group: "Communication",
  },
  {
    id: "screen-share",
    label: "Screen Share",
    description: "Start a screen sharing session",
    icon: <Monitor className="mr-2 h-4 w-4 text-green-500" />,
    keywords: ["share", "screen", "present", "desktop"],
    group: "Communication",
  },
  {
    id: "schedule-meeting",
    label: "Schedule Meeting",
    description: "Schedule a meeting for later",
    icon: <Calendar className="mr-2 h-4 w-4 text-purple-500" />,
    keywords: ["schedule", "meeting", "invite", "calendar", "event"],
    group: "Communication",
  },
  {
    id: "scheduling-assistant",
    label: "Scheduling Assistant",
    description: "Find available times across participants",
    icon: <Users className="mr-2 h-4 w-4 text-indigo-500" />,
    keywords: ["schedule", "availability", "assistant", "find time", "free", "busy"],
    group: "Calendar",
  },
  {
    id: "calendar-view",
    label: "Calendar View",
    description: "View your calendar and scheduled meetings",
    icon: <CalendarDays className="mr-2 h-4 w-4 text-orange-500" />,
    keywords: ["calendar", "schedule", "agenda", "events"],
    group: "Calendar",
  },
  {
    id: "meeting-notes",
    label: "Meeting Notes",
    description: "Create or view meeting notes",
    icon: <FileText className="mr-2 h-4 w-4 text-teal-500" />,
    keywords: ["notes", "meeting", "minutes", "document"],
    group: "Calendar",
  },
]

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function CommunicationPalette() {
  const { isOpen, setIsOpen, openModal, context } = useCommunicationPaletteContext()
  const { padName, stickTopic } = context
  const [search, setSearch] = useState("")

  // Clear search when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearch("")
    }
  }, [isOpen])

  // Filter actions based on search
  const filteredActions = useMemo(() => {
    if (!search) return COMMUNICATION_ACTIONS

    const lowerSearch = search.toLowerCase()
    return COMMUNICATION_ACTIONS.filter((action) => {
      const labelMatch = action.label.toLowerCase().includes(lowerSearch)
      const descMatch = action.description.toLowerCase().includes(lowerSearch)
      const keywordMatch = action.keywords.some((k) => k.includes(lowerSearch))
      return labelMatch || descMatch || keywordMatch
    })
  }, [search])

  // Group actions
  const groupedActions = useMemo(() => {
    const groups: Record<string, CommunicationActionItem[]> = {}
    filteredActions.forEach((action) => {
      if (!groups[action.group]) {
        groups[action.group] = []
      }
      groups[action.group].push(action)
    })
    return groups
  }, [filteredActions])

  const handleSelect = (actionId: CommunicationAction) => {
    openModal(actionId)
  }

  // Context display (shows what pad/stick we're in)
  const contextLabel = padName || stickTopic || null

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CommandInput
        placeholder="Search communication actions..."
        value={search}
        onValueChange={setSearch}
      />
      {contextLabel && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-b flex items-center gap-2">
          <Users className="h-3 w-3" />
          <span>Context: {contextLabel}</span>
        </div>
      )}
      <CommandList className="max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
        <CommandEmpty>No actions found.</CommandEmpty>
        {Object.entries(groupedActions).map(([group, items], index) => (
          <div key={group}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.id}
                  onSelect={() => handleSelect(action.id)}
                  className="flex items-start gap-2 py-2 sm:py-3 cursor-pointer"
                >
                  <div className="flex items-center flex-shrink-0">
                    {action.icon}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm sm:text-base">{action.label}</span>
                    <span className="text-xs text-muted-foreground truncate sm:whitespace-normal">
                      {action.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground hidden sm:block">
        Press <kbd className="bg-muted px-1 rounded">Esc</kbd> to close
        {" · "}
        <kbd className="bg-muted px-1 rounded">↑↓</kbd> to navigate
        {" · "}
        <kbd className="bg-muted px-1 rounded">Enter</kbd> to select
      </div>
    </CommandDialog>
  )
}

// ----------------------------------------------------------------------------
// Keyboard Shortcut Hint Component
// ----------------------------------------------------------------------------

export function CommunicationShortcutHint() {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Phone className="h-3 w-3" />
      <span>
        Press{" "}
        <kbd className="bg-muted px-1 py-0.5 rounded text-[10px] font-mono">
          ⌘J
        </kbd>{" "}
        for quick communication
      </span>
    </div>
  )
}
