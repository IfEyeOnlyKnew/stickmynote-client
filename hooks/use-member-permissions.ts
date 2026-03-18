"use client"

import { useState, useEffect } from "react"
import type { MemberPermissions } from "@/types/permissions"

export function useMemberPermissions(padId: string, userId?: string) {
  const [permissions, setPermissions] = useState<MemberPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!padId || !userId) {
      setLoading(false)
      return
    }

    fetchPermissions()
  }, [padId, userId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchPermissions = async () => {
    try {
      setLoading(true)

      // Get pad owner
      const padResponse = await fetch(`/api/inference-pads/${padId}`)
      if (padResponse.ok) {
        const padData = await padResponse.json()
        setIsOwner(padData.pad.owner_id === userId)

        if (padData.pad.owner_id === userId) {
          // Owner has all permissions
          setPermissions({
            can_create_sticks: true,
            can_reply: true,
            can_edit_others_sticks: true,
            can_delete_others_sticks: true,
            can_invite_members: true,
            can_pin_sticks: true,
          })
          setLoading(false)
          return
        }
      }

      // Get member permissions
      const response = await fetch(`/api/inference-pads/${padId}/members`)
      if (response.ok) {
        const data = await response.json()
        const member = data.members?.find((m: any) => m.user_id === userId)

        if (member) {
          setPermissions({
            can_create_sticks: member.can_create_sticks,
            can_reply: member.can_reply,
            can_edit_others_sticks: member.can_edit_others_sticks,
            can_delete_others_sticks: member.can_delete_others_sticks,
            can_invite_members: member.can_invite_members,
            can_pin_sticks: member.can_pin_sticks,
          })
        }
      }
    } catch (error) {
      console.error("Error fetching permissions:", error)
    } finally {
      setLoading(false)
    }
  }

  return {
    permissions,
    loading,
    isOwner,
    hasPermission: (permission: keyof MemberPermissions) => {
      if (isOwner) return true
      return permissions?.[permission] || false
    },
  }
}
