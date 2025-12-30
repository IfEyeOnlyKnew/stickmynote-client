import { redirect } from "next/navigation"
import dynamic from "next/dynamic"
import { getSession } from "@/lib/auth/local-auth"
import { requireFullAccess } from "@/lib/auth/check-hub-mode-access"

// Dynamically import the client component to prevent SSR issues with Tiptap
const CalSticksPageClient = dynamic(() => import("./page-client"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-muted-foreground">Loading CalSticks...</div>
    </div>
  ),
})

export default async function CalSticksPage() {
  const session = await getSession()

  if (!session) {
    redirect("/auth/login")
  }

  await requireFullAccess()

  return <CalSticksPageClient />
}
