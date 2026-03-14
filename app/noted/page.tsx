import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/local-auth"
import { NotedClient } from "./noted-client"

export default async function NotedPage() {
  const session = await getSession()
  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  return <NotedClient userId={session.user.id} />
}
