"use client"

import { useEffect, useCallback, useState } from "react"
import { useSearchParams } from "next/navigation"
import { BookOpen, Loader2, Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNoted } from "@/hooks/useNoted"
import { NotedGroupTabs } from "@/components/noted/NotedGroupTabs"
import { NotedPageList } from "@/components/noted/NotedPageList"
import { NotedPageEditor } from "@/components/noted/NotedPageEditor"
import { NotedTemplateGallery } from "@/components/noted/NotedTemplateGallery"
import { NotedTemplateEditor } from "@/components/noted/NotedTemplateEditor"
import { useNotedTemplates } from "@/hooks/useNotedTemplates"
import { NotedOfflineIndicator } from "@/components/noted/NotedOfflineIndicator"
import { useNotedOffline } from "@/hooks/useNotedOffline"
import { NotedWebClipperSetup } from "@/components/noted/NotedWebClipperSetup"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

interface NotedClientProps {
  userId: string
}

export function NotedClient({ userId }: NotedClientProps) {
  const searchParams = useSearchParams()
  const pageIdParam = searchParams.get("page")

  const {
    pages,
    groups,
    selectedPage,
    activeGroupId,
    loading,
    saving,
    searchQuery,
    setSearchQuery,
    setActiveGroupId,
    selectPage,
    createPage,
    updatePage,
    deletePage,
    createGroup,
    updateGroup,
    deleteGroup,
    loadMorePages,
    hasMore,
    loadingMore,
    fetchPages,
  } = useNoted()

  const { createTemplate } = useNotedTemplates()
  const { isOnline, syncPending, syncing, cachePagesForOffline, queueOfflineEdit, syncToServer } = useNotedOffline()

  const [showTemplateGallery, setShowTemplateGallery] = useState(false)
  const [showWebClipper, setShowWebClipper] = useState(false)
  const [saveAsTemplateData, setSaveAsTemplateData] = useState<{ title: string; content: string } | null>(null)

  // Auto-select page from URL param
  useEffect(() => {
    if (pageIdParam && pages.length > 0 && !selectedPage) {
      const page = pages.find((p) => p.id === pageIdParam)
      if (page) selectPage(page)
    }
  }, [pageIdParam, pages, selectedPage, selectPage])

  // Auto-select first page if none selected
  useEffect(() => {
    if (!selectedPage && pages.length > 0 && !pageIdParam) {
      selectPage(pages[0])
    }
  }, [pages, selectedPage, pageIdParam, selectPage])

  // Cache pages for offline access when they load
  useEffect(() => {
    if (pages.length > 0) {
      cachePagesForOffline(pages)
    }
  }, [pages, cachePagesForOffline])

  const handleSave = useCallback(
    (data: { title: string; content: string; group_id: string | null }) => {
      if (!selectedPage) return
      if (isOnline) {
        updatePage(selectedPage.id, {
          title: data.title,
          content: data.content,
          group_id: data.group_id,
        })
      } else {
        // Queue for sync when back online
        queueOfflineEdit(selectedPage.id, {
          title: data.title,
          content: data.content,
          group_id: data.group_id,
        })
      }
    },
    [selectedPage, updatePage, isOnline, queueOfflineEdit]
  )

  const handleCancel = useCallback(() => {
    // Re-fetch the page to restore original content
    if (selectedPage) selectPage(selectedPage)
  }, [selectedPage, selectPage])

  const handleGroupChange = useCallback(
    (groupId: string | null) => {
      if (selectedPage) {
        updatePage(selectedPage.id, { group_id: groupId })
      }
    },
    [selectedPage, updatePage]
  )

  const handleMoveToGroup = useCallback(
    (pageId: string, groupId: string | null) => {
      updatePage(pageId, { group_id: groupId })
    },
    [updatePage]
  )

  // Create a new page from template or blank
  const handleUseTemplate = useCallback(
    async (template: { title: string; content: string }) => {
      const page = await createPage({
        title: template.title || "Untitled",
        content: template.content || "",
        group_id: activeGroupId,
      })
      if (page) {
        await fetchPages()
        selectPage(page)
      }
    },
    [createPage, activeGroupId, fetchPages, selectPage]
  )

  // Save current page as a template
  const handleSaveAsTemplate = useCallback(
    (data: { title: string; content: string }) => {
      setSaveAsTemplateData(data)
    },
    []
  )

  const handleTemplateSaved = useCallback(
    async (data: { name: string; description: string; category: string; content: string }) => {
      await createTemplate(data)
      setSaveAsTemplateData(null)
    },
    [createTemplate]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Noted" },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setShowWebClipper(true)}
          >
            <Scissors className="h-3.5 w-3.5" />
            Web Clipper
          </Button>
          <NotedOfflineIndicator
            isOnline={isOnline}
            syncPending={syncPending}
            syncing={syncing}
            onSync={syncToServer}
          />
          <UserMenu />
        </div>
      </div>

      {/* Main content - 3-column layout: groups | page list | editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - groups & sub-groups */}
        <div className="w-56 shrink-0">
          <NotedGroupTabs
            groups={groups}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
            onCreateGroup={createGroup}
            onUpdateGroup={updateGroup}
            onDeleteGroup={deleteGroup}
          />
        </div>

        {/* Middle sidebar - page list */}
        <div className="w-72 shrink-0">
          <NotedPageList
            pages={pages}
            groups={groups}
            selectedPageId={selectedPage?.id || null}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectPage={selectPage}
            onDeletePage={deletePage}
            onMoveToGroup={handleMoveToGroup}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMorePages}
            onNewPage={() => setShowTemplateGallery(true)}
          />
        </div>

        {/* Right panel - editor */}
        <div className="flex-1 min-w-0">
          {selectedPage ? (
            <NotedPageEditor
              page={selectedPage}
              groups={groups}
              saving={saving}
              onSave={handleSave}
              onCancel={handleCancel}
              onGroupChange={handleGroupChange}
              onSaveAsTemplate={handleSaveAsTemplate}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Welcome to Noted
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Your notebook lives here. Click the{" "}
                <BookOpen className="inline h-4 w-4" /> icon on any Stick to
                create a Noted page, or select a page from the sidebar.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Template gallery dialog */}
      <NotedTemplateGallery
        open={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onUseTemplate={handleUseTemplate}
      />

      {/* Save as template dialog */}
      <NotedTemplateEditor
        open={!!saveAsTemplateData}
        onClose={() => setSaveAsTemplateData(null)}
        onSave={handleTemplateSaved}
        initialName={saveAsTemplateData?.title || ""}
        initialContent={saveAsTemplateData?.content || ""}
        title="Save as Template"
      />

      {/* Web clipper setup dialog */}
      <NotedWebClipperSetup
        open={showWebClipper}
        onClose={() => setShowWebClipper(false)}
      />
    </div>
  )
}
