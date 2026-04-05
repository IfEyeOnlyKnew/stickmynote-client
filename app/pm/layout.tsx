import { PMSidebar } from "@/components/pm/pm-sidebar"

export const metadata = {
  title: "Project Management Hub | StickyMyNote",
  description: "Timesheets, invoices, budget, portfolio, goals, templates, and forms",
}

export default function PMLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen overflow-hidden">
      <PMSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
