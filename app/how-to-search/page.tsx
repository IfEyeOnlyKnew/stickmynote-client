"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Info, Lightbulb } from "lucide-react"
import Link from "next/link"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

export default function HowToSearchPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Notes", href: "/notes" },
            { label: "How to Search", current: true },
          ]}
        />

        {/* Header */}
        <div className="flex items-center mb-6">
          <Link href="/notes">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Notes
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
              <Search className="h-8 w-8" />
              How to Search Your Notes
            </h1>
            <p className="text-gray-600">Master the search functionality to quickly find your notes</p>
          </div>

          {/* Basic Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Basic Search
              </CardTitle>
              <CardDescription>Search across all your note content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium mb-2">Example:</p>
                <Badge variant="outline" className="text-sm">
                  meeting notes
                </Badge>
              </div>
              <p className="text-sm text-gray-600">When you search without using colons, the search looks through:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
                <li>Note topics (titles)</li>
                <li>Note content (body text)</li>
                <li>Replies and comments</li>
              </ul>
            </CardContent>
          </Card>

          {/* Topic-Only Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Topic-Only Search
              </CardTitle>
              <CardDescription>Search specifically in note topics using colons</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="font-medium mb-2">Single Term:</p>
                <Badge variant="outline" className="text-sm">
                  project:
                </Badge>
                <p className="text-xs text-gray-600 mt-1">Finds notes where the topic contains "project"</p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="font-medium mb-2">Multiple Terms (AND logic):</p>
                <Badge variant="outline" className="text-sm">
                  sharepoint:list:management
                </Badge>
                <p className="text-xs text-gray-600 mt-1">
                  Finds notes where the topic contains ALL three words: "sharepoint", "list", AND "management"
                </p>
              </div>

              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="font-medium mb-2">Complex Example:</p>
                <Badge variant="outline" className="text-sm">
                  react:hooks:useeffect:tutorial
                </Badge>
                <p className="text-xs text-gray-600 mt-1">Finds notes where the topic contains all four terms</p>
              </div>
            </CardContent>
          </Card>

          {/* Search Examples */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Search Examples
              </CardTitle>
              <CardDescription>Common search patterns and what they find</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-medium">Basic Searches</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          javascript
                        </Badge>
                        <span className="text-xs text-gray-600">Any note mentioning JavaScript</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          meeting agenda
                        </Badge>
                        <span className="text-xs text-gray-600">Notes with both words anywhere</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Topic Searches</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          project:alpha
                        </Badge>
                        <span className="text-xs text-gray-600">Topics with "project" AND "alpha"</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          bug:fix:urgent
                        </Badge>
                        <span className="text-xs text-gray-600">Topics with all three terms</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips and Tricks */}
          <Card>
            <CardHeader>
              <CardTitle>Tips & Tricks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Case Insensitive</p>
                    <p className="text-sm text-gray-600">
                      Search is not case sensitive. "JavaScript", "javascript", and "JAVASCRIPT" all work the same.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Partial Matching</p>
                    <p className="text-sm text-gray-600">
                      You don't need to type the complete word. "react" will match "React", "reactive", "unreacted",
                      etc.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Clear Search</p>
                    <p className="text-sm text-gray-600">
                      Use the green "Clear Search" button at the bottom of the screen to reset your search and see all
                      notes.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Search Both Fields</p>
                    <p className="text-sm text-gray-600">
                      You can search in both the topic and content fields simultaneously for more comprehensive results.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Reference */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardHeader>
              <CardTitle>Quick Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Search Types</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>No colon:</strong> Search everywhere
                    </div>
                    <div>
                      <strong>With colon:</strong> Search topics only
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Colon Usage</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>Single:</strong> word:
                    </div>
                    <div>
                      <strong>Multiple:</strong> word1:word2:word3
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
