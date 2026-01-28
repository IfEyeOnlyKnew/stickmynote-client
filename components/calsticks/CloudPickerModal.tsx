"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Cloud, HardDrive, FolderOpen } from "lucide-react"
import { toast } from "sonner"

interface CloudPickerModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onFileSelect: (file: {
    name: string
    url: string
    size: number
    type: string
    provider: string
    provider_id: string
  }) => void
}

export function CloudPickerModal({ open, onClose, onFileSelect }: CloudPickerModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<"google-drive" | "onedrive" | "dropbox">("google-drive")

  const handleGoogleDrivePicker = () => {
    toast.info("Google Drive integration", {
      description: "This would open the Google Drive Picker API. Integration requires Google OAuth setup.",
    })
    // Example: Use Google Picker API with gapi.load('picker')
  }

  const handleOneDrivePicker = () => {
    toast.info("OneDrive integration", {
      description: "This would open the OneDrive File Picker. Integration requires Microsoft OAuth setup.",
    })
    // Example: Use OneDrive Picker API with window.OneDrive.open()
  }

  const handleDropboxPicker = () => {
    toast.info("Dropbox integration", {
      description: "This would open the Dropbox Chooser. Integration requires Dropbox OAuth setup.",
    })
    // Example: Use Dropbox.choose() API
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link from Cloud Storage</DialogTitle>
        </DialogHeader>

        <Tabs value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="google-drive" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Google Drive
            </TabsTrigger>
            <TabsTrigger value="onedrive" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              OneDrive
            </TabsTrigger>
            <TabsTrigger value="dropbox" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Dropbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="google-drive" className="space-y-4">
            <div className="text-center py-8">
              <Cloud className="h-16 w-16 mx-auto mb-4 text-blue-500" />
              <h3 className="text-lg font-medium mb-2">Connect to Google Drive</h3>
              <p className="text-sm text-gray-600 mb-4">Select files from your Google Drive to link to this task</p>
              <Button onClick={handleGoogleDrivePicker}>
                <Cloud className="h-4 w-4 mr-2" />
                Open Google Drive Picker
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="onedrive" className="space-y-4">
            <div className="text-center py-8">
              <HardDrive className="h-16 w-16 mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-medium mb-2">Connect to OneDrive</h3>
              <p className="text-sm text-gray-600 mb-4">Select files from your OneDrive to link to this task</p>
              <Button onClick={handleOneDrivePicker}>
                <HardDrive className="h-4 w-4 mr-2" />
                Open OneDrive Picker
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="dropbox" className="space-y-4">
            <div className="text-center py-8">
              <FolderOpen className="h-16 w-16 mx-auto mb-4 text-indigo-500" />
              <h3 className="text-lg font-medium mb-2">Connect to Dropbox</h3>
              <p className="text-sm text-gray-600 mb-4">Select files from your Dropbox to link to this task</p>
              <Button onClick={handleDropboxPicker}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Dropbox Chooser
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-4">
          <p className="text-xs text-gray-500 text-center">
            Cloud storage integrations require OAuth setup for each provider. Files are linked, not uploaded to your
            server.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
