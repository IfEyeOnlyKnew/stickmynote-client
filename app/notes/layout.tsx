import type React from "react";
import { UserMenu } from "@/components/user-menu";

// Add the UserMenu component to the layout's header
export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left side of header */}
            <div className="flex items-center gap-4">
              {/* Existing header content */}
            </div>

            {/* Right side of header - add UserMenu */}
            <div className="flex items-center gap-4">
              {/* Other header buttons */}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
