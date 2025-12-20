"use client"

import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ActivityFeedList } from "@/components/activity-feed/activity-feed-list"
import { Header } from "@/components/header"
import { ActivityIcon } from "lucide-react"

export default function ActivityPage() {
  const { user } = useUser()
  const router = useRouter()

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>You must be signed in to view your activity feed</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/auth/login")} className="w-full">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ActivityIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Activity Feed</h1>
          </div>
          <p className="text-muted-foreground">Stay up to date with recent actions on your notes and pads</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>See what&apos;s been happening across your workspace</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ActivityFeedList userId={user.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
