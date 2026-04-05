"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Share2, Lock, TagIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@/contexts/user-context"
import { useToast } from "@/hooks/use-toast"
import type { Note, Tag } from "@/types/note"

// Helper function to get relative time
const getRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return `${diffInDays}d ago`

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) return `${diffInMonths}mo ago`

  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears}y ago`
}

// Helper function to check if note has content
const hasNoteContent = (note: Note): boolean => {
  return Boolean(note.content?.trim())
}

export default function TagsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { toast } = useToast()
  const [note, setNote] = useState<Note | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const noteId = params.noteId as string

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/")
    }
  }, [user, userLoading, router])

  useEffect(() => {
    const loadNoteAndTags = async () => {
      if (!user || !noteId) return

      setLoading(true)
      try {
        // Use API endpoint for data fetching
        const response = await fetch(`/api/notes/${noteId}/tags`)
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to fetch note and tags")
        }

        const { note: noteData, tags: tagsData } = await response.json()

        if (!noteData) {
          throw new Error("Note data is missing or invalid.")
        }

        // Safely construct the Note object
        const transformedNote: Note = {
          id: noteData.id || "",
          user_id: noteData.user_id || user.id,
          title: noteData.title || noteData.topic || "Untitled",
          topic: noteData.topic || "Untitled",
          content: noteData.content || "",
          color: noteData.color || "#fef3c7",
          position_x: typeof noteData.position_x === "number" ? noteData.position_x : 0,
          position_y: typeof noteData.position_y === "number" ? noteData.position_y : 0,
          is_shared: typeof noteData.is_shared === "boolean" ? noteData.is_shared : true,
          tags: Array.isArray(tagsData) ? tagsData : [],
          videos: Array.isArray(noteData.videos) ? noteData.videos : [],
          images: Array.isArray(noteData.images) ? noteData.images : [],
          tabs: Array.isArray(noteData.tabs) ? noteData.tabs : [],
          replies: Array.isArray(noteData.replies) ? noteData.replies : [],
          created_at: noteData.created_at || new Date().toISOString(),
          updated_at: noteData.updated_at || new Date().toISOString(),
          z_index: typeof noteData.z_index === "number" ? noteData.z_index : 0,
        }

        setNote(transformedNote)
        setTags(Array.isArray(tagsData) ? tagsData : [])
        setError(null)
      } catch (err) {
        console.error("Error loading note and tags:", err)
        setError("Failed to load note and tags. Please try again.")
        toast({
          title: "Error",
          description: "Failed to load note and tags. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (user && noteId) {
      loadNoteAndTags()
    }
  }, [user, noteId, toast])

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <h2 className="text-xl font-semibold">Loading Tags...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (error || !note) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold text-red-600">Error</h2>
          <p className="text-gray-600">{error || "Note not found"}</p>
          <Button onClick={() => router.push("/personal")} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Personal
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.push("/personal")} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Personal
          </Button>
          <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">AI-Generated Tags</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Note Card */}
        <div className="lg:col-span-1">
          <Card className="p-6 shadow-lg bg-yellow-50">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Original Note</h2>
                <div className="flex items-center gap-2">
                  {note.is_shared ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded text-xs text-green-700">
                      <Share2 className="w-3 h-3" />
                      <span>Shared</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                      <Lock className="w-3 h-3" />
                      <span>Personal</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Topic */}
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-700 mb-1 block">Topic</span>
              <div className="p-2 bg-white/30 border border-black/20 rounded font-medium">{note.topic}</div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-700 mb-1 block">Content</span>
              <div className="p-2 bg-white/30 border border-black/20 rounded min-h-[100px] whitespace-pre-wrap">
                {hasNoteContent(note) ? note.content : "No content"}
              </div>
            </div>

            {/* Timestamp */}
            <div className="pt-2 border-t border-black/10 bg-black/5 rounded px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Created {getRelativeTime(new Date(note.created_at))}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Tags Section */}
        <div className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">AI-Generated Tags</h2>
            <p className="text-gray-600">
              These tags provide additional context and information related to your note topic.
            </p>
          </div>

          {tags.length === 0 ? (
            <Card className="p-8 text-center">
              <TagIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Tags Generated</h3>
              <p className="text-gray-500 mb-4">
                Tags haven&apos;t been generated for this note yet. Go back to the note and click &quot;Generate Tags&quot; to create
                AI-powered content tags.
              </p>
              <Button onClick={() => router.push("/personal")} variant="outline">
                Back to Personal
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {tags.map((tag, index) => (
                <Card key={tag.id} className="p-6 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Tag {index + 1}
                      </Badge>
                      <h3 className="text-lg font-semibold text-gray-800">{tag.tag_title}</h3>
                    </div>
                    <div className="text-xs text-gray-500">{tag.tag_content.length}/2000 chars</div>
                  </div>

                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{tag.tag_content}</div>

                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>Generated {getRelativeTime(new Date(tag.created_at))}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
