import { fetchUserSticks, type StickWithRole } from "@/lib/data/sticks-data"
import { MySticksClient } from "./mysticks-client"
import { requireFullAccess } from "@/lib/auth/check-hub-mode-access"

export default async function MySticksPage() {
  console.log("[v0] MySticksPage rendering")

  const user = await requireFullAccess()

  let sticks: StickWithRole[] = []
  try {
    sticks = await fetchUserSticks(user.id)
    console.log("[v0] MySticksPage - sticks fetched:", sticks.length)
  } catch (err) {
    console.error("[v0] MySticksPage - error fetching sticks:", err)
    // Return empty array on error so page still renders
  }

  return <MySticksClient initialSticks={sticks} />
}
