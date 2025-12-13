import { redirect } from "next/navigation"
import { createSupabaseServer } from "@/lib/supabase-server"
import CalSticksPageClient from "./page-client"
import { requireFullAccess } from "@/lib/auth/check-hub-mode-access"

export default async function CalSticksPage() {
  const supabase = await createSupabaseServer()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  await requireFullAccess()

  return <CalSticksPageClient />
}
