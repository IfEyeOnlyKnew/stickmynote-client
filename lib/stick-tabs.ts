import type { StickTab } from "@/types/pad"

export async function getStickTabs(id: string): Promise<StickTab[]> {
  try {
    const response = await fetch(`/api/sticks/${id}/tabs`)
    if (!response.ok) {
      throw new Error("Failed to fetch stick tabs")
    }
    const data = await response.json()
    return (data.tabs || []).map((tab: any) => ({
      id: tab.id,
      stick_id: tab.stick_id || id,
      tab_type: tab.tab_type === "video" ? "videos" : tab.tab_type,
      tab_data: tab.tab_data || {},
      created_at: tab.created_at,
      updated_at: tab.updated_at,
    }))
  } catch (error) {
    console.error("Error fetching stick tabs:", error)
    return []
  }
}

export async function saveStickTab(id: string, tabType: string, data: any): Promise<any> {
  try {
    console.log("[v0] saveStickTab called with:", { id, tabType, data })

    let mappedTabType = tabType
    if (tabType === "video") mappedTabType = "videos"
    else if (tabType === "image") mappedTabType = "images"

    const response = await fetch(`/api/sticks/${id}/tabs`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tab_type: mappedTabType,
        tab_data: data,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] saveStickTab API error:", errorText)
      throw new Error(`Failed to save stick tab: ${response.status}`)
    }

    const responseData = await response.json()
    console.log("[v0] saveStickTab success:", responseData)
    return {
      ...responseData.tab,
      note_id: responseData.tab?.stick_id || id,
    }
  } catch (error) {
    console.error("Error saving stick tab:", error)
    throw error
  }
}

export async function deleteStickTabItem(stickId: string, tabType: string, itemId: string): Promise<boolean> {
  try {
    console.log("[v0] deleteStickTabItem called with:", { stickId, tabType, itemId })

    const tabs = await getStickTabs(stickId)
    const targetTab = tabs.find((tab) => tab.tab_type === tabType)

    if (!targetTab) {
      console.log("[v0] No tab found for type:", tabType)
      return false
    }

    const currentItems = (targetTab as any).tab_data?.[tabType] || []
    console.log("[v0] Current items before deletion:", currentItems.length)

    const updatedItems = currentItems.filter((item: any) => item.id !== itemId)
    console.log("[v0] Items after filtering:", updatedItems.length)

    if (currentItems.length === updatedItems.length) {
      console.log("[v0] Item not found in tab data")
      return false
    }

    const response = await fetch(`/api/sticks/${stickId}/tabs`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tab_type: tabType,
        tab_data: { [tabType]: updatedItems },
      }),
    })

    const success = response.ok
    console.log("[v0] Delete operation result:", success)
    return success
  } catch (error) {
    console.error("Error deleting stick tab item:", error)
    return false
  }
}
