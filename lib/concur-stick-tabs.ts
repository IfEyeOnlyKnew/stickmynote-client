import type { StickTab } from "@/types/pad"

/**
 * Client-side functions for Concur stick tabs.
 * Mirrors lib/stick-tabs.ts but uses Concur-specific API routes.
 */

export async function getConcurStickTabs(groupId: string, stickId: string): Promise<StickTab[]> {
  try {
    const response = await fetch(`/api/concur/groups/${groupId}/sticks/${stickId}/tabs`)
    if (!response.ok) {
      throw new Error("Failed to fetch concur stick tabs")
    }
    const data = await response.json()
    return (data.tabs || []).map((tab: any) => ({
      id: tab.id,
      stick_id: tab.stick_id || stickId,
      tab_type: tab.tab_type === "video" ? "videos" : tab.tab_type,
      tab_data: tab.tab_data || {},
      created_at: tab.created_at,
      updated_at: tab.updated_at,
    }))
  } catch (error) {
    console.error("Error fetching concur stick tabs:", error)
    return []
  }
}

export async function saveConcurStickTab(groupId: string, stickId: string, tabType: string, data: any): Promise<any> {
  try {
    let mappedTabType = tabType
    if (tabType === "video") mappedTabType = "videos"
    else if (tabType === "image") mappedTabType = "images"

    const response = await fetch(`/api/concur/groups/${groupId}/sticks/${stickId}/tabs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tab_type: mappedTabType,
        tab_data: data,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to save concur stick tab: ${response.status}`)
    }

    const responseData = await response.json()
    return {
      ...responseData.tab,
      note_id: responseData.tab?.stick_id || stickId,
    }
  } catch (error) {
    console.error("Error saving concur stick tab:", error)
    throw error
  }
}

export async function deleteConcurStickTabItem(groupId: string, stickId: string, tabType: string, itemId: string): Promise<boolean> {
  try {
    const tabs = await getConcurStickTabs(groupId, stickId)
    const targetTab = tabs.find((tab) => tab.tab_type === tabType)

    if (!targetTab) return false

    const currentItems = (targetTab as any).tab_data?.[tabType] || []
    const updatedItems = currentItems.filter((item: any) => item.id !== itemId)

    if (currentItems.length === updatedItems.length) return false

    const response = await fetch(`/api/concur/groups/${groupId}/sticks/${stickId}/tabs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tab_type: tabType,
        tab_data: { [tabType]: updatedItems },
      }),
    })

    return response.ok
  } catch (error) {
    console.error("Error deleting concur stick tab item:", error)
    return false
  }
}
