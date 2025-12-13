"use client"

import type React from "react"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Search, Plus, BarChart3, Bell, Home, Users, FileText } from "lucide-react"

type CommandAction = {
  id: string
  label: string
  icon: React.ReactNode
  onSelect: () => void
  keywords?: string[]
  group?: string
}

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recentPads?: Array<{ id: string; name: string }>
  onCreateStick?: () => void
  onCreatePad?: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  recentPads = [],
  onCreateStick,
  onCreatePad,
}: CommandPaletteProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) {
      setSearch("")
    }
  }, [open])

  const actions: CommandAction[] = useMemo(() => {
    const baseActions: CommandAction[] = [
      {
        id: "home",
        label: "Go to Home",
        icon: <Home className="mr-2 h-4 w-4" />,
        onSelect: () => router.push("/social"),
        keywords: ["dashboard", "workspace"],
        group: "Navigation",
      },
      {
        id: "search",
        label: "Search Sticks",
        icon: <Search className="mr-2 h-4 w-4" />,
        onSelect: () => router.push("/social/search"),
        keywords: ["find", "query"],
        group: "Navigation",
      },
      {
        id: "my-pads",
        label: "My Pads",
        icon: <FileText className="mr-2 h-4 w-4" />,
        onSelect: () => router.push("/social/my-pads"),
        keywords: ["workspaces"],
        group: "Navigation",
      },
      {
        id: "activity",
        label: "Activity Feed",
        icon: <BarChart3 className="mr-2 h-4 w-4" />,
        onSelect: () => router.push("/social/activity"),
        keywords: ["updates", "recent"],
        group: "Navigation",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: <Bell className="mr-2 h-4 w-4" />,
        onSelect: () => router.push("/social/notifications"),
        keywords: ["alerts"],
        group: "Navigation",
      },
      {
        id: "hubs",
        label: "Browse Hubs",
        icon: <Users className="mr-2 h-4 w-4" />,
        onSelect: () => router.push("/social/hubs"),
        keywords: ["community", "public"],
        group: "Navigation",
      },
    ]

    if (onCreateStick) {
      baseActions.push({
        id: "new-stick",
        label: "Create New Stick",
        icon: <Plus className="mr-2 h-4 w-4" />,
        onSelect: () => {
          onOpenChange(false)
          onCreateStick()
        },
        keywords: ["add", "note"],
        group: "Actions",
      })
    }

    if (onCreatePad) {
      baseActions.push({
        id: "new-pad",
        label: "Create New Pad",
        icon: <Plus className="mr-2 h-4 w-4" />,
        onSelect: () => {
          onOpenChange(false)
          onCreatePad()
        },
        keywords: ["add", "workspace"],
        group: "Actions",
      })
    }

    // Add recent pads
    const padActions: CommandAction[] = recentPads.map((pad) => ({
      id: `pad-${pad.id}`,
      label: pad.name,
      icon: <FileText className="mr-2 h-4 w-4" />,
      onSelect: () => router.push(`/social?pad=${pad.id}`),
      keywords: ["pad", "workspace"],
      group: "Recent Pads",
    }))

    return [...baseActions, ...padActions]
  }, [router, recentPads, onCreateStick, onCreatePad, onOpenChange])

  const filteredActions = useMemo(() => {
    if (!search) return actions

    const lowerSearch = search.toLowerCase()
    return actions.filter((action) => {
      const labelMatch = action.label.toLowerCase().includes(lowerSearch)
      const keywordMatch = action.keywords?.some((k) => k.toLowerCase().includes(lowerSearch))
      return labelMatch || keywordMatch
    })
  }, [actions, search])

  const groupedActions = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {}
    filteredActions.forEach((action) => {
      const group = action.group || "Other"
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push(action)
    })
    return groups
  }, [filteredActions])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(groupedActions).map(([group, items], index) => (
          <div key={group}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => {
                    action.onSelect()
                    onOpenChange(false)
                  }}
                >
                  {action.icon}
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
