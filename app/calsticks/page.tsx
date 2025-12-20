import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/local-auth"
import CalSticksPageClient from "./page-client"
import { requireFullAccess } from "@/lib/auth/check-hub-mode-access"

export default async function CalSticksPage() {
  const session = await getSession()

  if (!session) {
    redirect("/auth/login")
  }

  await requireFullAccess()

  return <CalSticksPageClient />
}
