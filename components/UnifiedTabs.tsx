"use client"
import { useState, useEffect, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Play, ImageIcon, FileText } from "lucide-react"
import type { VideoItem, ImageItem } from "@/types/note"

interface UnifiedTabsConfig {
  entityType: "note" | "stick"
  entityId: string
  apiEndpoint: string
  isStick?: boolean
}

interface UnifiedTabsProps {
  entityId: string
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
  config: UnifiedTabsConfig
  // Stick-specific props
  isEditingTopic?: boolean
  isEditingContent?: boolean
  onCancelTopic?: () => void
  onCancelContent?: () => void
  onStickTopic?: () => void
  onStickContent?: () => void
  onGenerateTags?: () => void
  isGeneratingTags?: boolean
  // Note-specific props
  showBadges?: boolean
}

export function UnifiedTabs({
  entityId,
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
  showBadges = false,
}: UnifiedTabsProps) {
  const [activeTab, setActiveTab] = useState("main")
  const [topic, setTopic] = useState(initialTopic)
  const [content, setContent] = useState(initialContent)
  const [details, setDetails] = useState(initialDetails)
  const [tabs, setTabs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTabs = async () => {
      try {
        const response = await fetch(`${config.apiEndpoint}/${entityId}/tabs`)
        if (response.ok) {
          const data = await response.json()
          setTabs(data.tabs || [])
        }
      } catch (error) {
        console.error("Error loading tabs:", error)
      } finally {
        setLoading(false)
      }
    }
    loadTabs()
  }, [entityId, resetKey, config.apiEndpoint])

  const videos: VideoItem[] = useMemo(() => {
    const result: VideoItem[] = []
    tabs.forEach((tab) => {
      if (tab.tab_type === "videos" && (tab.tab_data as any)?.videos) {
        result.push(...(tab.tab_data as any).videos)
      }
    })
    return result
  }, [tabs])

  const images: ImageItem[] = useMemo(() => {
    const result: ImageItem[] = []
    tabs.forEach((tab) => {
      if (tab.tab_type === "images" && (tab.tab_data as any)?.images) {
        result.push(...(tab.tab_data as any).images)
      }
    })
    return result
  }, [tabs])

  const generatedTags: string[] = useMemo(() => {
    if (!config.isStick) return []
    const tagsTab = tabs.find((tab) => tab.tab_type === "tags")
    if (tagsTab) {
      const tabData = tagsTab.tab_data as any
      if (tabData?.tags && Array.isArray(tabData.tags)) {
        return tabData.tags
      }
    }
    return []
  }, [tabs, config.isStick])

  const generatedLinks: Array<{ title: string; url: string }> = useMemo(() => {
    if (!config.isStick) return []
    const linksTab = tabs.find((tab) => tab.tab_type === "links")
    if (linksTab) {
      const tabData = linksTab.tab_data as any
      if (tabData?.hyperlinks && Array.isArray(tabData.hyperlinks)) {
        return tabData.hyperlinks
      }
    }
    return []
  }, [tabs, config.isStick])

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

  const handleDetailsChange = (newDetails: string) => {
    setDetails(newDetails)
    onDetailsChange?.(newDetails)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v)
          onTabChange?.(v)
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger
            value="main"
            className="flex items-center gap-2 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Main
          </TabsTrigger>

          <TabsTrigger
            value="videos"
            className="flex items-center gap-2 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <Play className="h-4 w-4" />
            Videos
            {showBadges && videos.length > 0 && <Badge variant="secondary">{videos.length}</Badge>}
          </TabsTrigger>

          <TabsTrigger
            value="images"
            className="flex items-center gap-2 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <ImageIcon className="h-4 w-4" />
            Images
            {showBadges && images.length > 0 && <Badge variant="secondary">{images.length}</Badge>}
          </TabsTrigger>

          <TabsTrigger
            value="details"
            className="flex items-center gap-2 data-[state=inactive]:border-2 data-[state=inactive]:border-gray-400 data-[state=inactive]:bg-white data-[state=inactive]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4">
          {/* Content editor will be rendered here based on entity type */}
          <div className="text-sm text-gray-500">
            Main tab content for {config.entityType} {entityId}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <div className="text-sm text-gray-500">Videos: {videos.length}</div>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <div className="text-sm text-gray-500">Images: {images.length}</div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="text-sm text-gray-500">Details tab</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
