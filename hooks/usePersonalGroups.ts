"use client"

import { useState, useCallback, useEffect } from "react"

export interface PersonalGroup {
  id: string
  name: string
  color: string
  sort_order: number
  stick_count: number
  created_at: string
}

interface Membership {
  group_id: string
  stick_id: string
}

interface UsePersonalGroupsReturn {
  groups: PersonalGroup[]
  memberships: Membership[]
  loading: boolean
  selectedGroupId: string | null
  setSelectedGroupId: (id: string | null) => void
  getStickIdsForGroup: (groupId: string) => Set<string>
  getGroupsForStick: (stickId: string) => string[]
  createGroup: (name: string, color?: string) => Promise<PersonalGroup | null>
  updateGroup: (id: string, updates: { name?: string; color?: string }) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  addStickToGroup: (groupId: string, stickId: string) => Promise<void>
  removeStickFromGroup: (groupId: string, stickId: string) => Promise<void>
  refreshGroups: () => Promise<void>
}

export function usePersonalGroups(shouldLoad: boolean): UsePersonalGroupsReturn {
  const [groups, setGroups] = useState<PersonalGroup[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const fetchGroups = useCallback(async () => {
    try {
      const [groupsRes, membershipsRes] = await Promise.all([
        fetch("/api/personal-groups"),
        fetch("/api/personal-groups/memberships"),
      ])
      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setGroups(data.groups || [])
      }
      if (membershipsRes.ok) {
        const data = await membershipsRes.json()
        setMemberships(data.memberships || [])
      }
    } catch (error) {
      console.error("[usePersonalGroups] fetch error:", error)
    }
  }, [])

  const refreshGroups = useCallback(async () => {
    setLoading(true)
    await fetchGroups()
    setLoading(false)
  }, [fetchGroups])

  useEffect(() => {
    if (shouldLoad) {
      refreshGroups()
    }
  }, [shouldLoad, refreshGroups])

  const getStickIdsForGroup = useCallback(
    (groupId: string): Set<string> => {
      const ids = new Set<string>()
      for (const m of memberships) {
        if (m.group_id === groupId) ids.add(m.stick_id)
      }
      return ids
    },
    [memberships]
  )

  const getGroupsForStick = useCallback(
    (stickId: string): string[] => {
      return memberships.filter((m) => m.stick_id === stickId).map((m) => m.group_id)
    },
    [memberships]
  )

  const createGroup = useCallback(async (name: string, color?: string): Promise<PersonalGroup | null> => {
    try {
      const res = await fetch("/api/personal-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const newGroup = data.group
      setGroups((prev) => [...prev, newGroup])
      return newGroup
    } catch {
      return null
    }
  }, [])

  const updateGroup = useCallback(async (id: string, updates: { name?: string; color?: string }) => {
    try {
      const res = await fetch("/api/personal-groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      })
      if (res.ok) {
        const data = await res.json()
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...data.group } : g)))
      }
    } catch (error) {
      console.error("[usePersonalGroups] updateGroup error:", error)
    }
  }, [])

  const deleteGroup = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/personal-groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== id))
        setMemberships((prev) => prev.filter((m) => m.group_id !== id))
        setSelectedGroupId((prev) => (prev === id ? null : prev))
      }
    } catch (error) {
      console.error("[usePersonalGroups] deleteGroup error:", error)
    }
  }, [])

  const addStickToGroup = useCallback(async (groupId: string, stickId: string) => {
    try {
      const res = await fetch(`/api/personal-groups/${groupId}/sticks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickId }),
      })
      if (res.ok) {
        setMemberships((prev) => [...prev, { group_id: groupId, stick_id: stickId }])
        setGroups((prev) =>
          prev.map((g) => (g.id === groupId ? { ...g, stick_count: g.stick_count + 1 } : g))
        )
      }
    } catch (error) {
      console.error("[usePersonalGroups] addStickToGroup error:", error)
    }
  }, [])

  const removeStickFromGroup = useCallback(async (groupId: string, stickId: string) => {
    try {
      const res = await fetch(`/api/personal-groups/${groupId}/sticks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickId }),
      })
      if (res.ok) {
        setMemberships((prev) => prev.filter((m) => !(m.group_id === groupId && m.stick_id === stickId)))
        setGroups((prev) =>
          prev.map((g) => (g.id === groupId ? { ...g, stick_count: Math.max(0, g.stick_count - 1) } : g))
        )
      }
    } catch (error) {
      console.error("[usePersonalGroups] removeStickFromGroup error:", error)
    }
  }, [])

  return {
    groups,
    memberships,
    loading,
    selectedGroupId,
    setSelectedGroupId,
    getStickIdsForGroup,
    getGroupsForStick,
    createGroup,
    updateGroup,
    deleteGroup,
    addStickToGroup,
    removeStickFromGroup,
    refreshGroups,
  }
}
