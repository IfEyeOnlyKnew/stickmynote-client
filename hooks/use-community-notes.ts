"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/contexts/user-context"
import { createSupabaseBrowser } from "@/lib/supabase-browser"

export interface CommunityNote {
  id: string
  title: string
  content: string
  author: string
  authorId: string
  avatar: string
  likes: number
  comments: number
  tags: string[]
  isLiked: boolean
  trending: boolean
  createdAt: string
}

export const useCommunityNotes = () => {
  const { user } = useUser()
  const [notes, setNotes] = useState<CommunityNote[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadNotes = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const supabase = createSupabaseBrowser()

      // Fetch shared notes with their stats
      const { data: sharedNotes, error: notesError } = await supabase
        .from("personal_sticks")
        .select(`
          id,
          topic,
          content,
          user_id,
          created_at,
          updated_at,
          personal_sticks_tags(tag),
          personal_sticks_replies(id),
          personal_sticks_reactions(id, user_id, reaction_type)
        `)
        .eq("is_shared", true)
        .order("created_at", { ascending: false })
        .limit(10)

      if (notesError) {
        console.error("Error fetching community notes:", notesError)
        setNotes([])
        return
      }

      // Get unique user IDs
      const userIds = [...new Set((sharedNotes || []).map((n: { user_id: string }) => n.user_id))]

      // Fetch user details
      let usersMap: Record<string, { email: string; display_name?: string; avatar_url?: string }> = {}
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, email, display_name, avatar_url")
          .in("id", userIds)

        if (users) {
          usersMap = users.reduce(
            (
              acc: Record<string, { email: string; display_name?: string; avatar_url?: string }>,
              u: { id: string; email: string; display_name?: string; avatar_url?: string },
            ) => {
              acc[u.id] = { email: u.email, display_name: u.display_name, avatar_url: u.avatar_url }
              return acc
            },
            {} as typeof usersMap,
          )
        }
      }

      // Transform to CommunityNote format
      const transformedNotes: CommunityNote[] = (sharedNotes || []).map(
        (note: {
          id: string
          user_id: string
          topic?: string
          content?: string
          created_at: string
          personal_sticks_tags?: { tag: string }[]
          personal_sticks_replies?: { id: string }[]
          personal_sticks_reactions?: { user_id: string; reaction_type: string }[]
        }) => {
          const userInfo = usersMap[note.user_id] || { email: "Unknown" }
          const tags = (note.personal_sticks_tags || []).map((t: { tag: string }) => t.tag)
          const replies = note.personal_sticks_replies || []
          const reactions = note.personal_sticks_reactions || []
          const likes = reactions.filter((r: { reaction_type: string }) => r.reaction_type === "like").length
          const isLiked = reactions.some(
            (r: { user_id: string; reaction_type: string }) => r.user_id === user.id && r.reaction_type === "like",
          )

          // Determine if trending (more than 5 likes or recent activity)
          const trending = likes > 5 || replies.length > 3

          return {
            id: note.id,
            title: note.topic || "Untitled",
            content: note.content || "",
            author: userInfo.display_name || userInfo.email?.split("@")[0] || "Anonymous",
            authorId: note.user_id,
            avatar: userInfo.avatar_url || "/diverse-avatars.png",
            likes,
            comments: replies.length,
            tags,
            isLiked,
            trending,
            createdAt: note.created_at,
          }
        },
      )

      setNotes(transformedNotes)
    } catch (error) {
      console.error("Error loading community notes:", error)
      setNotes([])
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const updateNote = (noteId: string, updates: Partial<CommunityNote>) => {
    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, ...updates } : note)))
  }

  const refreshNotes = async () => {
    await loadNotes()
  }

  return {
    notes,
    isLoading,
    updateNote,
    refreshNotes,
  }
}
