"use client"

import { useState } from "react"
import { RichTextEditor } from "@/components/rich-text/RichTextEditor"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Header } from "@/components/header"
import { Eye, Code } from "lucide-react"

export default function RichTextDemoPage() {
  const [content, setContent] = useState("<p>Start typing to see the rich text editor in action!</p>")
  const [showPreview, setShowPreview] = useState(true)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Rich Text Editor Demo</h1>
          <p className="text-muted-foreground">
            Explore the enhanced rich text editing capabilities with formatting, tables, images, and more
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Editor</CardTitle>
              <CardDescription>
                Try out bold, italic, underline, headings, lists, code blocks, tables, and more
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Start typing your content here..."
                maxLength={10000}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Output</CardTitle>
                  <CardDescription>See how your content looks and the HTML it generates</CardDescription>
                </div>
                <Tabs value={showPreview ? "preview" : "html"} onValueChange={(v) => setShowPreview(v === "preview")}>
                  <TabsList>
                    <TabsTrigger value="preview" className="gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="html" className="gap-2">
                      <Code className="h-4 w-4" />
                      HTML
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {showPreview ? (
                <div
                  className="prose prose-sm max-w-none p-4 border rounded-md bg-white min-h-[200px]"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <pre className="p-4 bg-gray-900 text-gray-100 rounded-md overflow-x-auto text-sm">
                  <code>{content}</code>
                </pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Text Formatting</h3>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Bold, Italic, Underline</li>
                    <li>• Headings (H1, H2, H3)</li>
                    <li>• Text Highlighting</li>
                    <li>• Text Alignment</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Content Types</h3>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Bullet & Numbered Lists</li>
                    <li>• Blockquotes</li>
                    <li>• Code Blocks with Syntax Highlighting</li>
                    <li>• Tables with Headers</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Media</h3>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Image Upload</li>
                    <li>• Paste Images</li>
                    <li>• Hyperlinks</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Shortcuts</h3>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Ctrl+B for Bold</li>
                    <li>• Ctrl+I for Italic</li>
                    <li>• Ctrl+U for Underline</li>
                    <li>• Ctrl+Z/Y for Undo/Redo</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
