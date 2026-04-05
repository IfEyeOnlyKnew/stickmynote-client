"use client"

import { useState, useMemo } from "react"
import { Plus, X, Pencil, ChevronDown, ChevronRight, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { NotedGroup } from "@/hooks/useNoted"

const GROUP_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#64748b", // slate
]

interface NotedGroupTabsProps {
  groups: NotedGroup[]
  activeGroupId: string | null
  onSelectGroup: (groupId: string | null) => void
  onCreateGroup: (name: string, color: string, parentId?: string | null) => void
  onUpdateGroup: (id: string, data: { name?: string; color?: string }) => void
  onDeleteGroup: (id: string) => void
}

export function NotedGroupTabs({
  groups,
  activeGroupId,
  onSelectGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: Readonly<NotedGroupTabsProps>) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<NotedGroup | null>(null)
  const [groupName, setGroupName] = useState("")
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0])
  const [parentId, setParentId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Separate top-level groups from sub-groups
  const topLevelGroups = useMemo(
    () => groups.filter((g) => !g.parent_id),
    [groups]
  )

  const subGroupsByParent = useMemo(() => {
    const map = new Map<string, NotedGroup[]>()
    for (const g of groups) {
      if (g.parent_id) {
        const existing = map.get(g.parent_id) || []
        existing.push(g)
        map.set(g.parent_id, existing)
      }
    }
    return map
  }, [groups])

  const toggleExpand = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const handleCreate = () => {
    if (!groupName.trim()) return
    onCreateGroup(groupName.trim(), groupColor, parentId)
    setGroupName("")
    setGroupColor(GROUP_COLORS[0])
    setParentId(null)
    setShowCreateModal(false)
  }

  const handleUpdate = () => {
    if (!editingGroup || !groupName.trim()) return
    onUpdateGroup(editingGroup.id, { name: groupName.trim(), color: groupColor })
    setEditingGroup(null)
    setGroupName("")
  }

  const openEdit = (group: NotedGroup, e: React.MouseEvent) => {
    e.stopPropagation()
    setGroupName(group.name)
    setGroupColor(group.color)
    setEditingGroup(group)
  }

  const openCreateSubGroup = (parentGroupId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setGroupName("")
    setGroupColor(GROUP_COLORS[0])
    setParentId(parentGroupId)
    setShowCreateModal(true)
  }

  // Check if a group or any of its sub-groups is active
  const isGroupOrChildActive = (groupId: string) => {
    if (activeGroupId === groupId) return true
    const children = subGroupsByParent.get(groupId) || []
    return children.some((c) => c.id === activeGroupId)
  }

  return (
    <>
      <div className="flex flex-col h-full border-r bg-muted/10">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Groups</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setGroupName("")
              setGroupColor(GROUP_COLORS[0])
              setParentId(null)
              setShowCreateModal(true)
            }}
            className="h-6 w-6 p-0"
            title="New Group"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Group list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {/* All pages item */}
            <button
              type="button"
              onClick={() => onSelectGroup(null)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors text-left",
                activeGroupId === null
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              )}
            >
              All Pages
            </button>

            {/* Top-level groups */}
            {topLevelGroups.map((group) => {
              const children = subGroupsByParent.get(group.id) || []
              const hasChildren = children.length > 0
              const isExpanded = expandedGroups.has(group.id)
              const isActive = activeGroupId === group.id
              const isChildActive = isGroupOrChildActive(group.id) && !isActive

              return (
                <div key={group.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer group",
                      (() => {
                        if (isActive) return "bg-primary text-primary-foreground"
                        if (isChildActive) return "bg-muted/60 text-foreground"
                        return "hover:bg-muted text-foreground"
                      })()
                    )}
                    onClick={() => onSelectGroup(group.id)}
                  >
                    {/* Expand/collapse toggle */}
                    {hasChildren ? (
                      <span
                        aria-label={isExpanded ? "Collapse group" : "Expand group"}
                        onClick={(e) => toggleExpand(group.id, e)}
                        onKeyDown={(e) => e.key === "Enter" && toggleExpand(group.id, e as unknown as React.MouseEvent)}
                        className="h-4 w-4 flex items-center justify-center shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </span>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="truncate flex-1">{group.name}</span>

                    {/* Context menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={cn(
                            "h-5 w-5 rounded flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                            isActive ? "hover:bg-primary-foreground/20" : "hover:bg-muted-foreground/20"
                          )}
                        >
                          <Pencil className="h-3 w-3" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="left">
                        <DropdownMenuItem onClick={(e) => openEdit(group, e as unknown as React.MouseEvent)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit Group
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => openCreateSubGroup(group.id, e as unknown as React.MouseEvent)}>
                          <Plus className="h-3.5 w-3.5 mr-2" />
                          Add Sub-group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </button>

                  {/* Sub-groups */}
                  {hasChildren && isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {children.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          className={cn(
                            "w-full flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer group/sub",
                            activeGroupId === sub.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted text-foreground"
                          )}
                          onClick={() => onSelectGroup(sub.id)}
                        >
                          <span className="w-4 shrink-0" />
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: sub.color }}
                          />
                          <span className="truncate flex-1">{sub.name}</span>
                          <span
                            title="Edit sub-group"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); openEdit(sub, e) }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openEdit(sub, e as unknown as React.MouseEvent) } }}
                            className={cn(
                              "h-4 w-4 rounded flex items-center justify-center shrink-0 opacity-0 group-hover/sub:opacity-100 transition-opacity",
                              activeGroupId === sub.id ? "hover:bg-primary-foreground/20" : "hover:bg-muted-foreground/20"
                            )}
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Create/Edit group modal */}
      <Dialog
        open={showCreateModal || !!editingGroup}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false)
            setEditingGroup(null)
            setParentId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                if (editingGroup) return "Edit Group"
                if (parentId) return "New Sub-group"
                return "New Group"
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={parentId ? "Sub-group name..." : "Group name..."}
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  editingGroup ? handleUpdate() : handleCreate()
                }
              }}
              autoFocus
            />

            {/* Parent group selector (only when creating, not editing) */}
            {!editingGroup && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Parent Group</p>
                <Select
                  value={parentId || "__none"}
                  onValueChange={(val) => setParentId(val === "__none" ? null : val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None (top-level)</SelectItem>
                    {topLevelGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: g.color }}
                          />
                          {g.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Select color ${color}`}
                    onClick={() => setGroupColor(color)}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all",
                      groupColor === color && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {editingGroup && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDeleteGroup(editingGroup.id)
                  setEditingGroup(null)
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                setEditingGroup(null)
                setParentId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingGroup ? handleUpdate : handleCreate}
              disabled={!groupName.trim()}
            >
              {editingGroup ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
