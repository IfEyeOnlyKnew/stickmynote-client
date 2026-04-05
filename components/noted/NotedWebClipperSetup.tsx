"use client"

import { useState } from "react"
import { Scissors, Copy, Check, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface NotedWebClipperSetupProps {
  open: boolean
  onClose: () => void
}

export function NotedWebClipperSetup({ open, onClose }: Readonly<NotedWebClipperSetupProps>) {
  const [copied, setCopied] = useState(false)

  // Bookmarklet code - clips selected text or page content to Noted
  const bookmarkletCode = `javascript:void(function(){var s=window.getSelection().toString();var t=document.title;var u=window.location.href;var c=s||document.body.innerText.substring(0,2000);var d={title:t,url:u,selection:s?'<blockquote>'+s+'</blockquote>':'',content:s?'':'<p>'+c.substring(0,2000)+'</p>'};fetch('/api/noted/clip',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(d)}).then(function(r){if(r.ok){alert('Clipped to Noted!')}else{alert('Failed to clip. Make sure you are logged in to Stick My Note.')}}).catch(function(){window.open('${typeof globalThis.window === "undefined" ? "" : globalThis.location.origin}/noted','_blank')})}())`

  const handleCopy = () => {
    navigator.clipboard.writeText(bookmarkletCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Web Clipper Setup
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0">Step 1</Badge>
              <span className="text-sm font-medium">Drag the button to your bookmarks bar</span>
            </div>
            <div className="bg-muted rounded-lg p-4 flex items-center justify-center">
              <a
                href={bookmarkletCode}
                onClick={(e) => e.preventDefault()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium cursor-grab active:cursor-grabbing shadow-sm hover:shadow"
                title="Drag this to your bookmarks bar"
              >
                <GripVertical className="h-4 w-4" />
                <Scissors className="h-4 w-4" />
                Clip to Noted
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Drag the &quot;Clip to Noted&quot; button above to your browser&apos;s bookmarks bar.
              If you can&apos;t see the bookmarks bar, press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+Shift+B</kbd>.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0">Step 2</Badge>
              <span className="text-sm font-medium">Use it on any page</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>Select text on any page, then click &quot;Clip to Noted&quot; to save just the selection</li>
              <li>Click without selecting to clip the page title and first 2000 characters</li>
              <li>The clip is saved as a new Noted page with a link back to the source</li>
              <li>You must be logged in to Stick My Note for clipping to work</li>
            </ul>
          </div>

          {/* Alternative: Copy code */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Can&apos;t drag? Copy the bookmarklet code and create a bookmark manually:
            </p>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy Bookmarklet Code"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
