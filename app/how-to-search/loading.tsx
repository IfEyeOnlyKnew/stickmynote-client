import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function HowToSearchLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded" />
              <Skeleton className="h-8 w-40" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <Skeleton className="h-12 w-80 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>

          {/* Search Examples Section */}
          <Card className="mb-8">
            <CardHeader>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-full" />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Example 1 */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <div className="bg-gray-100 p-4 rounded-lg">
                  <Skeleton className="h-5 w-full mb-2" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>

              {/* Example 2 */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <div className="bg-gray-100 p-4 rounded-lg">
                  <Skeleton className="h-5 w-full mb-2" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>

              {/* Example 3 */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-36" />
                <div className="bg-gray-100 p-4 rounded-lg">
                  <Skeleton className="h-5 w-full mb-2" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>

          {/* Search Tips Section */}
          <Card className="mb-8">
            <CardHeader>
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-5 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons, no reorder/identity
                <div key={`tip-skeleton-${index}`} className="flex items-start gap-3">
                  <Skeleton className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Advanced Features Section */}
          <Card className="mb-8">
            <CardHeader>
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-5 w-full" />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Feature 1 */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="bg-blue-50 p-4 rounded-lg">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>

              {/* Feature 2 */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <div className="bg-green-50 p-4 rounded-lg">
                  <Skeleton className="h-5 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>

              {/* Feature 3 */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="bg-purple-50 p-4 rounded-lg">
                  <Skeleton className="h-5 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Reference Section */}
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-5 w-full" />
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  {Array.from({ length: 4 }).map((_, index) => (
                    // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
                    <div key={`left-ref-${index}`} className="flex items-center gap-3">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-36" />
                  {Array.from({ length: 4 }).map((_, index) => (
                    // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
                    <div key={`right-ref-${index}`} className="flex items-center gap-3">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Back Button */}
          <div className="text-center mt-8">
            <Skeleton className="h-10 w-32 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
