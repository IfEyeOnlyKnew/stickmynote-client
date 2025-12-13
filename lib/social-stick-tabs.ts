export async function getSocialStickTabs(socialStickId: string) {
  const res = await fetch(`/api/social-sticks/${encodeURIComponent(socialStickId)}/tabs`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to load social stick tabs (${res.status})`)
  }

  const json = await res.json().catch(() => ({}))
  return Array.isArray(json?.tabs) ? json.tabs : []
}

export async function saveSocialStickTab(
  socialStickId: string,
  tabType: "video" | "videos" | "images",
  data: any[] | { videos?: any[]; images?: any[] },
) {
  const normalizedTabType = tabType === "images" ? "images" : "videos"
  const items = Array.isArray(data) ? data : (data as any)[normalizedTabType] || []

  const res = await fetch(`/api/social-sticks/${encodeURIComponent(socialStickId)}/tabs`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabType: normalizedTabType, items }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to save social stick tab (${res.status})`)
  }

  return res.json()
}

export async function deleteSocialStickTabItem(
  socialStickId: string,
  tabType: "video" | "videos" | "images",
  itemId: string,
) {
  const normalizedTabType = tabType === "images" ? "images" : "videos"

  const res = await fetch(`/api/social-sticks/${encodeURIComponent(socialStickId)}/tabs`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabType: normalizedTabType, itemId }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Failed to delete social stick tab item (${res.status})`)
  }

  return res.json()
}
