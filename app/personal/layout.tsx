import { PanelSidebar } from "@/components/panel/panel-sidebar"

export const metadata = {
  title: "Personal Sticks | StickyMyNote",
  description: "Your personal sticks dashboard",
}

export default function PersonalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen overflow-hidden">
      <PanelSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
