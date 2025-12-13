import { MyPadsClient } from "./mypads-client"
import { fetchUserPads, type PadWithRole } from "@/lib/data/pads-data"
import { requireFullAccess } from "@/lib/auth/check-hub-mode-access"

export default async function MyPadsPage() {
  console.log("[v0] MyPadsPage rendering")

  const user = await requireFullAccess()

  let pads: PadWithRole[] = []
  try {
    pads = await fetchUserPads(user.id)
    console.log("[v0] MyPadsPage - Pads fetched successfully:", {
      count: pads.length,
      padIds: pads.map((p) => p.id),
      roles: pads.map((p) => ({ id: p.id, role: p.userRole, accepted: p.accepted })),
    })
  } catch (err) {
    console.error("[v0] MyPadsPage - Error fetching pads:", err)
  }

  return <MyPadsClient initialPads={pads} />
}
