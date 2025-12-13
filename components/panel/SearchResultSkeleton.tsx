export function SearchResultSkeleton() {
  return (
    <div className="search-result-card" style={{ backgroundColor: "#f9fafb" }}>
      <div className="relative p-5 space-y-4">
        {/* Header skeleton */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            {/* Avatar skeleton */}
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              {/* Name skeleton */}
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              {/* Date skeleton */}
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Topic skeleton */}
        <div className="space-y-2">
          <div className="h-5 w-3/4 bg-gray-300 rounded animate-pulse" />
          <div className="h-5 w-1/2 bg-gray-300 rounded animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Tags skeleton */}
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-6 w-14 bg-gray-200 rounded-full animate-pulse" />
        </div>

        {/* Footer skeleton */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex gap-4">
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function SearchResultsSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
        {Array.from({ length: count }).map((_, i) => (
          <SearchResultSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
