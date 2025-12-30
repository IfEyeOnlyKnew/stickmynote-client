"use client"

import dynamic from "next/dynamic"

// Dynamically import RichTextEditor with SSR disabled to prevent Tiptap SSR errors
const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((mod) => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="border border-gray-300 rounded-md p-3 min-h-[120px] bg-gray-50">
        <div className="animate-pulse flex items-center justify-center h-full">
          <div className="text-gray-500">Loading editor...</div>
        </div>
      </div>
    ),
  }
)

export { RichTextEditor }
export default RichTextEditor
