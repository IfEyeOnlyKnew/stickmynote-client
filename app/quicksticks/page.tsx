import { QuickSticksPageClient } from "./page-client"
import { requireFullAccess } from "@/lib/auth/check-hub-mode-access"

export default async function QuickSticksPage() {
  const user = await requireFullAccess()

  return <QuickSticksPageClient user={user} />
}
