import { Loader2 } from "lucide-react";

export default function PersonalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <h2 className="text-xl font-semibold">Loading Personal Hub...</h2>
      </div>
    </div>
  );
}
