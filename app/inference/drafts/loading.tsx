export default function DraftsLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent" />
        <p className="text-purple-600 font-medium">Loading drafts...</p>
      </div>
    </div>
  )
}
