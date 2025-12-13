"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Star } from "lucide-react"
import { useCommunityNotes } from "@/hooks/use-community-notes"
import { useCommunityInteractions } from "@/hooks/use-community-interactions"
import { CommunityStats } from "./community/CommunityStats"
import { CommunityNoteCard } from "./community/CommunityNoteCard"

export function CommunityPanel() {
  const { notes, isLoading, updateNote } = useCommunityNotes()
  const { handleLike, handleShare, handleComment } = useCommunityInteractions(updateNote)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="text-sm text-gray-500">Loading community notes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CommunityStats />

      {/* Trending Notes */}
      <Card className="panel-card-enhanced border-0 shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400"></div>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="metric-icon bg-gradient-to-br from-yellow-100 to-orange-100">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            Trending Community Notes
          </CardTitle>
          <CardDescription className="text-gray-600">Popular notes from the community this week</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.map((note) => (
            <CommunityNoteCard
              key={note.id}
              note={note}
              onLike={handleLike}
              onShare={handleShare}
              onComment={handleComment}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Default export for compatibility
export default CommunityPanel
