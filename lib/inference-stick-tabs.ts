export async function getInferenceStickTabs(inferenceStickId: string) {
  const res = await fetch(`/api/inference-sticks/${encodeURIComponent(inferenceStickId)}/tabs`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to load inference stick tabs (${res.status})`)
  }

  const json = await res.json().catch(() => ({}))
  return Array.isArray(json?.tabs) ? json.tabs : []
}

export async function saveInferenceStickTab(
  inferenceStickId: string,
  tabType: "video" | "videos" | "images",
  data: any[] | { videos?: any[]; images?: any[] },
) {
  const normalizedTabType = tabType === "images" ? "images" : "videos"
  const items = Array.isArray(data) ? data : (data as any)[normalizedTabType] || []

  const res = await fetch(`/api/inference-sticks/${encodeURIComponent(inferenceStickId)}/tabs`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabType: normalizedTabType, items }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to save inference stick tab (${res.status})`)
  }

  return res.json()
}

export async function deleteInferenceStickTabItem(
  inferenceStickId: string,
  tabType: "video" | "videos" | "images",
  itemId: string,
) {
  const normalizedTabType = tabType === "images" ? "images" : "videos"

  const res = await fetch(`/api/inference-sticks/${encodeURIComponent(inferenceStickId)}/tabs`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabType: normalizedTabType, itemId }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to delete inference stick tab item (${res.status})`)
  }

  return res.json()
}
