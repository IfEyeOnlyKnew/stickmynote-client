"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Send, Sparkles, History, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface Citation {
  topic: string
  relevance: string
  stick_id?: string
}

interface QAHistoryItem {
  id: string
  question: string
  answer: string
  citations: Citation[]
  asked_at: string
  was_helpful: boolean | null
}

interface PadQADialogProps {
  padId: string
  padName: string
  trigger?: React.ReactNode
}

export function PadQADialog({ padId, padName, trigger }: Readonly<PadQADialogProps>) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [citations, setCitations] = useState<Citation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("ask")

  const [history, setHistory] = useState<QAHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [currentQAId, setCurrentQAId] = useState<string | null>(null)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open && activeTab === "history") {
      fetchHistory()
    }
  }, [open, activeTab, padId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/inference-pads/${padId}/qa-history?limit=20`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error("Error fetching Q&A history:", error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim()) return

    setIsLoading(true)
    setAnswer("")
    setCitations([])
    setCurrentQAId(null)

    try {
      const response = await fetch(`/api/inference-pads/${padId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      })

      if (!response.ok) {
        throw new Error("Failed to get answer")
      }

      const data = await response.json()
      setAnswer(data.answer)
      setCitations(data.citations || [])
      setCurrentQAId(data.qa_id || null)
    } catch (error) {
      console.error("Error asking question:", error)
      toast.error("Failed to get answer. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFeedback = async (wasHelpful: boolean) => {
    if (!currentQAId) return

    try {
      await fetch(`/api/inference-pads/qa/${currentQAId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ was_helpful: wasHelpful }),
      })
      toast.success("Thanks for your feedback!")
    } catch (error) {
      console.error("Error submitting feedback:", error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const handleReuseQuestion = (q: string) => {
    setQuestion(q)
    setActiveTab("ask")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Ask the Thread
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Ask about {padName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ask" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Ask
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ask" className="space-y-4 mt-4">
            {/* Question Input */}
            <div className="flex gap-2">
              <Input
                placeholder="What's blocking the mobile release?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={handleAsk} disabled={isLoading || !question.trim()}>
                {isLoading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            {/* Answer */}
            {answer && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-900">{answer}</p>

                  {currentQAId && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-200">
                      <span className="text-xs text-gray-500">Was this helpful?</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleFeedback(true)}>
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleFeedback(false)}>
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Citations */}
                {citations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Referenced Sticks</h4>
                    <div className="space-y-2">
                      {citations.map((citation, idx) => (
                        <div key={citation.topic} className="flex items-start gap-2 text-sm">
                          <Badge variant="secondary" className="text-xs">
                            {idx + 1}
                          </Badge>
                          <div>
                            <p className="font-medium text-gray-900">{citation.topic}</p>
                            <p className="text-xs text-gray-600">{citation.relevance}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Suggested Questions */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-700">Try asking:</h4>
              <div className="flex flex-wrap gap-2">
                {["What's the current status?", "What are the blockers?", "Who's working on what?"].map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestion(q)}
                    className="text-xs"
                    disabled={isLoading}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {loadingHistory && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
            {!loadingHistory && history.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No questions asked yet</p>
              </div>
            )}
            {!loadingHistory && history.length > 0 && (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-gray-900">{item.question}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          onClick={() => handleReuseQuestion(item.question)}
                        >
                          Ask again
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600">{item.answer}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{formatDistanceToNow(new Date(item.asked_at), { addSuffix: true })}</span>
                        {item.was_helpful !== null && (
                          <Badge variant={item.was_helpful ? "default" : "secondary"} className="text-xs">
                            {item.was_helpful ? "Helpful" : "Not helpful"}
                          </Badge>
                        )}
                        {item.citations?.length > 0 && (
                          <span>
                            {item.citations.length} citation{item.citations.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
