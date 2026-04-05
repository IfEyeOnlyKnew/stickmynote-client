"use client"

import { Hash, Volume2, MessageSquare } from "lucide-react"

export default function ChannelsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-10 h-10 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Channels</h1>
        <p className="text-gray-500 mb-8">
          Persistent team channels for organized conversations. Create text channels for discussions
          or voice channels for drop-in audio.
        </p>

        <div className="grid grid-cols-1 gap-4 text-left">
          <div className="flex items-start gap-3 p-4 bg-white rounded-lg border hover:border-indigo-300 transition-colors">
            <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Text Channels</p>
              <p className="text-sm text-gray-500">Organized discussions with threads, reactions, and pinned messages</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-white rounded-lg border hover:border-green-300 transition-colors">
            <Volume2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Voice Channels</p>
              <p className="text-sm text-gray-500">Drop-in audio rooms powered by LiveKit — always on, join anytime</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-400 mt-6">
          Select a channel from the sidebar or create a new one
        </p>
      </div>
    </div>
  )
}
