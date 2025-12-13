import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/types/note"

export async function getCommunitySharedNotes(searchTerm: string): Promise<Note[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  let query = supabase
    .from("notes")
    .select("*")
    .eq("is_shared", true)
    .order("created_at", { ascending: false })
    .limit(100)

  if (searchTerm.trim()) {
    if (searchTerm.includes(":")) {
      const topicKeywords = searchTerm
        .split(":")
        .map((word) => word.trim())
        .filter((word) => word.length > 0)
      topicKeywords.forEach((keyword) => {
        query = query.ilike("topic", `%${keyword}%`)
      })
    } else {
      query = query.or(`topic.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
    }
  } else {
    return []
  }

  const { data: notesData, error: notesError } = await query
  if (notesError) throw notesError
  if (!notesData || notesData.length === 0) return []

  const noteIds = notesData.map((note: any) => note.id)
  const userIds = [...new Set(notesData.map((note: any) => note.user_id))]

  const { data: noteTabsData } = await (supabase as any)
    .from("note_tabs")
    .select("*")
    .in("note_id", noteIds)
    .order("tab_order", { ascending: true })

  const { data: usersData } = await (supabase as any).from("users").select("id, username, email").in("id", userIds)

  const { data: repliesData } = await (supabase as any).from("replies").select("*").in("note_id", noteIds)

  const { data: tagsData } = await (supabase as any).from("tags").select("*").in("note_id", noteIds)

  const usersMap = new Map()
  usersData?.forEach((userData: any) => usersMap.set(userData.id, userData))

  const finalNotes = notesData.map((note: any) => {
    const noteAuthor = usersMap.get(note.user_id)
    const contentTab = noteTabsData?.find((tab: any) => tab.note_id === note.id && tab.tab_type === "content")
    const topicValue = note.topic || ""
    return {
      id: note.id as string,
      topic: topicValue as string,
      title: topicValue as string, // Added title property to match Note interface
      content: (contentTab?.tab_content || note.content || "") as string,
      color: note.color as string,
      created_at: note.created_at as string,
      updated_at: note.updated_at as string,
      is_shared: note.is_shared as boolean,
      user_id: note.user_id as string,
      author: {
        username: noteAuthor?.username as string | null,
        email: noteAuthor?.email as string,
      },
      position_x: typeof note.position_x === "number" ? note.position_x : 0,
      position_y: typeof note.position_y === "number" ? note.position_y : 0,
      videos: [],
      images: [],
      hyperlinks: [],
      replies: (repliesData || [])
        .filter((reply: any) => reply.note_id === note.id)
        .map((reply: any) => ({
          id: reply.id as string,
          note_id: reply.note_id as string,
          user_id: reply.user_id as string,
          content: reply.content as string,
          color: reply.color as string,
          created_at: reply.created_at as string,
          updated_at: reply.updated_at as string,
        })),
      tags: (tagsData || []).filter((tag: any) => tag.note_id === note.id).map((tag: any) => tag.tag_title as string),
      z_index: 1,
    }
  })
  return finalNotes
}
