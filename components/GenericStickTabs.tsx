"use client"
import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Play, ImageIcon, FileText, FolderOpen } from "lucide-react"
import type { VideoItem, ImageItem } from "@/types/pad"
import type { StickTabsConfig } from "@/types/stick-tabs-config"

import { useStickTabs } from "@/hooks/use-stick-tabs"
import { useStickVideoManagement } from "@/hooks/use-stick-video-management"
import { useStickImageManagement } from "@/hooks/use-stick-image-management"
import { useStickFileUpload } from "@/hooks/use-stick-file-upload"
import { StickContentEditor } from "@/components/stick-tabs/StickContentEditor"
import { VideoTabContent } from "@/components/note-tabs/VideoTabContent"
import { ImageTabContent } from "@/components/note-tabs/ImageTabContent"
import { LibraryPanel } from "@/components/library/LibraryPanel"

// DetailsTabContent uses Tiptap which requires client-side only rendering
const DetailsTabContent = dynamic(
  () => import("@/components/note-tabs/DetailsTabContent").then((mod) => mod.DetailsTabContent),
  { ssr: false }
)

interface GenericStickTabsProps {
  stickId: string
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
  config: StickTabsConfig
  isEditingTopic?: boolean
  isEditingContent?: boolean
  onCancelTopic?: () => void
  onCancelContent?: () => void
  onStickTopic?: () => void
  onStickContent?: () => void
  onGenerateTags?: () => void
  isGeneratingTags?: boolean
  onSummarizeLinks?: () => void
  isSummarizingLinks?: boolean
  stickType?: "personal" | "concur" | "alliance" | "inference"
}

export function GenericStickTabs({
  stickId,
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
  isEditingTopic,
  isEditingContent,
  onCancelTopic,
  onCancelContent,
  onStickTopic,
  onStickContent,
  onGenerateTags,
  isGeneratingTags,
  onSummarizeLinks,
  isSummarizingLinks,
  stickType,
}: Readonly<GenericStickTabsProps>) {
  const [activeTab, setActiveTab] = useState("main")
  const [topic, setTopic] = useState(initialTopic)
  const [content, setContent] = useState(initialContent)
  const [details, setDetails] = useState(initialDetails)
  const [fileCount, setFileCount] = useState(0)

  const { stickTabs, setStickTabs, loading, refreshTabs } = useStickTabs(stickId, resetKey, config)

  const videoManagement = useStickVideoManagement(stickId, config, setStickTabs, onTabChange)
  const imageManagement = useStickImageManagement(stickId, config, setStickTabs, onTabChange)
  const fileUpload = useStickFileUpload(stickId, config, setStickTabs, onTabChange)

  const videos: VideoItem[] = useMemo(() => {
    const result: VideoItem[] = []
    stickTabs.forEach((tab) => {
      if (tab.tab_type === "videos" && (tab.tab_data as any)?.videos) {
        result.push(...(tab.tab_data as any).videos)
      }
    })
    return result
  }, [stickTabs])

  const images: ImageItem[] = useMemo(() => {
    const result: ImageItem[] = []
    stickTabs.forEach((tab) => {
      if (tab.tab_type === "images" && (tab.tab_data as any)?.images) {
        result.push(...(tab.tab_data as any).images)
      }
    })
    return result
  }, [stickTabs])

  const generatedTags: string[] = useMemo(() => {
    const tagsTab = stickTabs.find((tab) => tab.tab_type === "tags")
    if (tagsTab) {
      const tabData = tagsTab.tab_data as any
      if (tabData?.tags && Array.isArray(tabData.tags)) {
        return tabData.tags
      }
    }
    return []
  }, [stickTabs])

  const generatedLinks: Array<{ title: string; url: string }> = useMemo(() => {
    const linksTab = stickTabs.find((tab) => tab.tab_type === "links")
    if (linksTab) {
      const tabData = linksTab.tab_data as any
      if (tabData?.hyperlinks && Array.isArray(tabData.hyperlinks)) {
        return tabData.hyperlinks
      }
    }
    return []
  }, [stickTabs])

  useEffect(() => {
    const handleRefresh = () => {
      refreshTabs()
    }

    globalThis.addEventListener("refreshStickTabs", handleRefresh)
    return () => globalThis.removeEventListener("refreshStickTabs", handleRefresh)
  }, [refreshTabs])

  useEffect(() => {
    setDetails(initialDetails)
  }, [initialDetails])

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
    onDetailsChange?.(newDetails)
    // Refresh tabs to get the updated details from the database
    await refreshTabs()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
      </div>
    )
  }

  return (
    <div className="!w-full !min-w-0 !max-w-full">
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
          </TabsTrigger>

          <TabsTrigger
            value="images"
            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 min-w-0 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <ImageIcon className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Images</span>
          </TabsTrigger>

          <TabsTrigger
            value="details"
            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 min-w-0 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Details</span>
          </TabsTrigger>

          {stickType && (
            <TabsTrigger
              value="files"
              className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 min-w-0 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
            >
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline truncate">Files</span>
              {fileCount > 0 && <Badge variant="secondary" className="hidden sm:flex">{fileCount}</Badge>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="main" className="space-y-4 !w-full !min-w-0 !max-w-full">
          <StickContentEditor
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
            isEditingTopic={isEditingTopic}
            isEditingContent={isEditingContent}
            onCancelTopic={onCancelTopic}
            onCancelContent={onCancelContent}
            onStickTopic={onStickTopic}
            onStickContent={onStickContent}
            onGenerateTags={onGenerateTags}
            isGeneratingTags={isGeneratingTags}
            onSummarizeLinks={onSummarizeLinks}
            isSummarizingLinks={isSummarizingLinks}
            generatedTags={generatedTags}
            generatedLinks={generatedLinks}
            details={details}
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
            onPasteImage={(file) => fileUpload.handlePasteImage(file, images)}
          />
        </TabsContent>

        <TabsContent value="details" className="space-y-4 !w-full !min-w-0 !max-w-full !overflow-hidden">
          <DetailsTabContent
            noteId={stickId}
            details={details}
            noteTabs={stickTabs as any}
            readOnly={readOnly}
            config={config as any}
            onDetailsChange={handleDetailsChange}
            onRefreshTabs={refreshTabs}
          />
        </TabsContent>

        {stickType && (
          <TabsContent value="files" className="space-y-4 !w-full !min-w-0 !max-w-full !overflow-hidden">
            <LibraryPanel stickId={stickId} stickType={stickType} readOnly={readOnly} onFileCountChange={setFileCount} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
