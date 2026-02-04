"use client"
import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Play, ImageIcon, FileText } from "lucide-react"
import type { VideoItem, ImageItem } from "@/types/note"
import type { NoteTabsConfig } from "@/types/note-tabs-config"

import { useNoteTabs } from "@/hooks/use-note-tabs"
import { useVideoManagement } from "@/hooks/use-video-management"
import { useImageManagement } from "@/hooks/use-image-management"
import { useFileUpload } from "@/hooks/use-file-upload"
import { NoteContentEditor } from "@/components/note-tabs/NoteContentEditor"
import { VideoTabContent } from "@/components/note-tabs/VideoTabContent"
import { ImageTabContent } from "@/components/note-tabs/ImageTabContent"

// DetailsTabContent uses Tiptap which requires client-side only rendering
const DetailsTabContent = dynamic(
  () => import("@/components/note-tabs/DetailsTabContent").then((mod) => mod.DetailsTabContent),
  { ssr: false }
)

interface GenericNoteTabsProps {
  noteId: string
  initialTopic: string
  initialContent: string
  initialDetails?: string
  onTopicChange: (value: string) => void
  onContentChange: (value: string) => void
  onDetailsChange?: (value: string) => void
  onTopicFocus?: () => void
  onContentFocus?: () => void
  readOnly?: boolean
  resetKey?: number
  onTabChange?: (tabName: string) => void
  showMedia?: boolean
  config: NoteTabsConfig
  isEditing?: boolean
  onCancel?: () => void
  onStick?: () => void
  isSaving?: boolean
}

export function GenericNoteTabs({
  noteId,
  initialTopic,
  initialContent,
  initialDetails = "",
  onTopicChange,
  onContentChange,
  onDetailsChange,
  onTopicFocus,
  onContentFocus,
  readOnly = false,
  resetKey,
  onTabChange,
  showMedia = false,
  config,
  isEditing,
  onCancel,
  onStick,
  isSaving,
}: GenericNoteTabsProps) {
  const [activeTab, setActiveTab] = useState("main")
  const [topic, setTopic] = useState(initialTopic)
  const [content, setContent] = useState(initialContent)
  const [details, setDetails] = useState(initialDetails)

  const { noteTabs, setNoteTabs, loading, refreshTabs } = useNoteTabs(noteId, resetKey, config)

  const videoManagement = useVideoManagement(noteId, config, setNoteTabs, onTabChange)
  const imageManagement = useImageManagement(noteId, config, setNoteTabs, onTabChange)
  const fileUpload = useFileUpload(noteId, config, setNoteTabs, onTabChange)

  useEffect(() => {
    setTopic(initialTopic)
    setContent(initialContent)
  }, [initialTopic, initialContent, resetKey])

  useEffect(() => {
    const detailsTab = noteTabs.find((tab) => tab.tab_type === "details")
    if (detailsTab && (detailsTab.tab_data as any)?.content) {
      setDetails((detailsTab.tab_data as any).content)
    }
  }, [noteTabs])

  const videos: VideoItem[] = useMemo(() => {
    const result: VideoItem[] = []
    noteTabs.forEach((tab) => {
      if (tab.tab_type === "videos") {
        const tabVideos = (tab.tab_data as any)?.videos
        if (tabVideos && Array.isArray(tabVideos)) {
          result.push(...tabVideos)
        }
      }
    })
    return result
  }, [noteTabs])

  const images: ImageItem[] = useMemo(() => {
    const result: ImageItem[] = []
    noteTabs.forEach((tab) => {
      if (tab.tab_type === "images" && (tab.tab_data as any)?.images) {
        result.push(...(tab.tab_data as any).images)
      }
    })
    return result
  }, [noteTabs])

  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic)
    onTopicChange?.(newTopic)
  }

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    onContentChange?.(newContent)
  }

  const handleDetailsChange = async (newDetails: string) => {
    setDetails(newDetails)
    if (onDetailsChange) {
      await onDetailsChange(newDetails)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
      </div>
    )
  }

  return (
    <div className="!w-full !min-w-0 !max-w-full !overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v)
          onTabChange?.(v)
        }}
        className="!w-full !min-w-0 !max-w-full"
      >
        <TabsList className="flex !w-full !min-w-0 !max-w-full">
          <TabsTrigger
            value="main"
            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 min-w-0 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Main</span>
          </TabsTrigger>

          <TabsTrigger
            value="videos"
            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 min-w-0 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <Play className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Videos</span>
            {videos.length > 0 && <Badge variant="secondary" className="hidden sm:flex">{videos.length}</Badge>}
          </TabsTrigger>

          <TabsTrigger
            value="images"
            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 min-w-0 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <ImageIcon className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Images</span>
            {images.length > 0 && <Badge variant="secondary" className="hidden sm:flex">{images.length}</Badge>}
          </TabsTrigger>

          <TabsTrigger
            value="details"
            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 min-w-0 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Details</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4 !w-full !min-w-0 !max-w-full !overflow-hidden">
          <NoteContentEditor
            topic={topic}
            content={content}
            onTopicChange={handleTopicChange}
            onContentChange={handleContentChange}
            onTopicFocus={onTopicFocus}
            onContentFocus={onContentFocus}
            readOnly={readOnly}
            showMedia={showMedia}
            videos={videos}
            images={images}
            onDeleteVideo={undefined}
            onDeleteImage={undefined}
            isEditing={isEditing}
            onCancel={onCancel}
            onStick={onStick}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="videos" className="space-y-4 !w-full !min-w-0 !max-w-full !overflow-hidden">
          <VideoTabContent
            videos={videos}
            videoUrl={videoManagement.videoUrl}
            addingVideo={videoManagement.addingVideo}
            readOnly={readOnly}
            onVideoUrlChange={videoManagement.setVideoUrl}
            onAddVideo={() => videoManagement.handleAddVideo(videos)}
            onDeleteVideo={videoManagement.handleDeleteVideo}
          />
        </TabsContent>

        <TabsContent value="images" className="space-y-4 !w-full !min-w-0 !max-w-full !overflow-hidden">
          <ImageTabContent
            images={images}
            imageUrl={imageManagement.imageUrl}
            addingImage={imageManagement.addingImage}
            selectedFile={fileUpload.selectedFile}
            uploadingFile={fileUpload.uploadingFile}
            readOnly={readOnly}
            onImageUrlChange={imageManagement.setImageUrl}
            onAddImageFromUrl={() => imageManagement.handleAddImageFromUrl(images)}
            onFileSelect={fileUpload.handleFileSelect}
            onUploadPersonalImage={() => fileUpload.handleUploadPersonalImage(images)}
            onDeleteImage={imageManagement.handleDeleteImage}
          />
        </TabsContent>

        <TabsContent value="details" className="space-y-4 !w-full !min-w-0 !max-w-full !overflow-hidden">
          <DetailsTabContent
            noteId={noteId}
            details={details}
            noteTabs={noteTabs}
            readOnly={readOnly}
            config={config}
            onDetailsChange={handleDetailsChange}
            onRefreshTabs={refreshTabs}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
