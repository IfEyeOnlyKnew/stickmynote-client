"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, FolderOpen, Folder, Pencil, Trash2, X, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsMobile } from "@/hooks/use-mobile"
import type { PersonalGroup } from "@/hooks/usePersonalGroups"

const GROUP_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
]

interface PersonalGroupsSidebarProps {
  groups: PersonalGroup[]
  selectedGroupId: string | null
  onSelectGroup: (id: string | null) => void
  onCreateGroup: (name: string, color?: string) => Promise<PersonalGroup | null>
  onRenameGroup: (id: string, name: string) => Promise<void>
  onDeleteGroup: (id: string) => Promise<void>
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function PersonalGroupsSidebar({
  groups,
  selectedGroupId,
  onSelectGroup,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  mobileOpen,
  onMobileClose,
}: PersonalGroupsSidebarProps) {
  const isMobile = useIsMobile()
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isCollapsed, setIsCollapsed] = useState(false)
  const createInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isCreating && createInputRef.current) {
      createInputRef.current.focus()
    }
  }, [isCreating])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

  const handleCreate = async () => {
    if (!newGroupName.trim()) return
    await onCreateGroup(newGroupName.trim(), newGroupColor)
    setNewGroupName("")
    setNewGroupColor(GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)])
    setIsCreating(false)
  }

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return
    await onRenameGroup(id, editingName.trim())
    setEditingId(null)
    setEditingName("")
  }

  const handleDelete = async (id: string) => {
    if (!globalThis.confirm("Delete this group? Sticks in the group will NOT be deleted.")) return
    await onDeleteGroup(id)
  }

  // Mobile: overlay drawer triggered by parent
  if (isMobile) {
    if (!mobileOpen) return null
    return (
      <div className="fixed inset-0 z-[9998]">
        <div className="absolute inset-0 bg-black/40" onClick={onMobileClose} />
        <div className="absolute top-0 left-0 h-full w-64 bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Groups</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreating(true)}
                className="h-7 w-7 p-0"
                title="Create group"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onMobileClose}
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onSelectGroup(null); onMobileClose?.() }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                selectedGroupId === null
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">All Sticks</span>
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => { onSelectGroup(selectedGroupId === group.id ? null : group.id); onMobileClose?.() }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                  selectedGroupId === group.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div
                  className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: group.color }}
                >
                  <Folder className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="truncate flex-1 text-left">{group.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{group.stick_count}</span>
              </button>
            ))}
          </div>
          {isCreating && (
            <div className="border-t border-gray-100 p-3 space-y-2">
              <Input
                ref={createInputRef}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                  if (e.key === "Escape") setIsCreating(false)
                }}
                placeholder="Group name..."
                className="h-8 text-sm"
              />
              <div className="flex items-center gap-1 flex-wrap">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewGroupColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      newGroupColor === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                    title={`Select color ${c}`}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={handleCreate} disabled={!newGroupName.trim()} className="flex-1 h-7 text-xs">
                  Create
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setIsCreating(false); setNewGroupName("") }} className="h-7 text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-1 bg-white border-r border-gray-200 min-h-[calc(100vh-200px)]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(false)}
          className="mb-4 p-1"
          title="Expand groups"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(selectedGroupId === group.id ? null : group.id)}
            className={`w-8 h-8 rounded-full mb-2 flex items-center justify-center text-xs font-bold text-white transition-all ${
              selectedGroupId === group.id ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"
            }`}
            style={{ backgroundColor: group.color }}
            title={group.name}
          >
            {group.name.charAt(0).toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelectGroup(null)}
          className={`w-8 h-8 rounded-full mb-2 flex items-center justify-center text-xs transition-all ${
            selectedGroupId === null
              ? "bg-gray-200 ring-2 ring-offset-2 ring-gray-400"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
          title="All Sticks"
        >
          <FolderOpen className="h-3.5 w-3.5 text-gray-600" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 min-h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Groups</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreating(true)}
            className="h-7 w-7 p-0"
            title="Create group"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="h-7 w-7 p-0"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Group List */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* "All Sticks" option */}
        <button
          type="button"
          onClick={() => onSelectGroup(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
            selectedGroupId === null
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <FolderOpen className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">All Sticks</span>
        </button>

        {/* Groups */}
        {groups.map((group) => (
          <div key={group.id} className="group relative">
            {editingId === group.id ? (
              <div className="flex items-center gap-1 px-2 py-1">
                <Input
                  ref={editInputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(group.id)
                    if (e.key === "Escape") setEditingId(null)
                  }}
                  className="h-7 text-sm"
                />
                <Button variant="ghost" size="sm" onClick={() => handleRename(group.id)} className="h-7 w-7 p-0">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSelectGroup(selectedGroupId === group.id ? null : group.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  selectedGroupId === group.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div
                  className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: group.color }}
                >
                  <Folder className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="truncate flex-1 text-left">{group.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{group.stick_count}</span>
              </button>
            )}
            {/* Edit/Delete actions on hover */}
            {editingId !== group.id && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-white rounded shadow-sm border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(group.id)
                    setEditingName(group.name)
                  }}
                  className="h-6 w-6 p-0"
                  title="Rename"
                >
                  <Pencil className="h-3 w-3 text-gray-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(group.id)
                  }}
                  className="h-6 w-6 p-0"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Group Form */}
      {isCreating && (
        <div className="border-t border-gray-100 p-3 space-y-2">
          <Input
            ref={createInputRef}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate()
              if (e.key === "Escape") setIsCreating(false)
            }}
            placeholder="Group name..."
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-1 flex-wrap">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewGroupColor(c)}
                className={`w-5 h-5 rounded-full transition-transform ${
                  newGroupColor === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleCreate} disabled={!newGroupName.trim()} className="flex-1 h-7 text-xs">
              Create
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false)
                setNewGroupName("")
              }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
