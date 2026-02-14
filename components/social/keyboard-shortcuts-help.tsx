"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

type KeyboardShortcut = {
  keys: string[]
  description: string
  category: string
}

const shortcuts: KeyboardShortcut[] = [
  { keys: ["Cmd", "K"], description: "Open command palette", category: "General" },
  { keys: ["Cmd", "Shift", "J"], description: "Open communication palette", category: "General" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "General" },
  { keys: ["Esc"], description: "Close dialog or clear selection", category: "General" },
  { keys: ["Cmd", "N"], description: "Create new stick", category: "Actions" },
  { keys: ["Cmd", "Shift", "N"], description: "Create new pad", category: "Actions" },
  { keys: ["Cmd", "/"], description: "Search sticks", category: "Navigation" },
  { keys: ["G", "H"], description: "Go to home", category: "Navigation" },
  { keys: ["G", "S"], description: "Go to search", category: "Navigation" },
  { keys: ["G", "P"], description: "Go to my pads", category: "Navigation" },
  { keys: ["G", "A"], description: "Go to activity", category: "Navigation" },
  { keys: ["G", "N"], description: "Go to notifications", category: "Navigation" },
  { keys: ["Cmd", "A"], description: "Select all visible sticks", category: "Selection" },
  { keys: ["Shift", "Click"], description: "Multi-select sticks", category: "Selection" },
]

type KeyboardShortcutsHelpProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const categories = Array.from(new Set(shortcuts.map((s) => s.category)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Speed up your workflow with these keyboard shortcuts</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-3">{category}</h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <Badge variant="outline" className="font-mono text-xs">
                              {key}
                            </Badge>
                            {i < shortcut.keys.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
