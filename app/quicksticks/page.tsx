import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { QuickSticksPageClient } from "./page-client"
import { requireFullAccess } from "@/lib/auth/check-hub-mode-access"

async function getQuickSticks() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return { user }
}

export default async function QuickSticksPage() {
  const user = await requireFullAccess()

  return <QuickSticksPageClient user={user} />
}
