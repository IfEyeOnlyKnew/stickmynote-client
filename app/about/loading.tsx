import { Loader2 } from "lucide-react";

export default function AboutLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <h2 className="text-lg font-semibold">Loading About Page...</h2>
      </div>
    </div>
  );
}
