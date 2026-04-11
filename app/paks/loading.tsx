import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function PaksLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <Skeleton className="h-8 w-48 mx-auto mb-2" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
          <Card key={i}>
            <CardHeader className="text-center">
              <Skeleton className="w-12 h-12 rounded-lg mx-auto mb-4" />
              <Skeleton className="h-6 w-32 mx-auto mb-2" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-4 w-40 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
