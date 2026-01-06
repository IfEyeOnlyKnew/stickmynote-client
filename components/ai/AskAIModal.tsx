"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, X, Sparkles } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { toast } from "sonner"

interface AskAIModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  stickType: "personal" | "social" | "paks"
  onAnswerKept?: () => void
}

export function AskAIModal({ open, onOpenChange, stickId, stickType, onAnswerKept }: AskAIModalProps) {
  const { user } = useUser()
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasAsked, setHasAsked] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<{
    remaining_sessions: number
    max_sessions: number
    can_ask: boolean
  } | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState(false)

  // Check remaining sessions when modal opens
  useEffect(() => {
    if (open && user) {
      checkRemainingSessionsFn()
    }
  }, [open, user])

  const checkRemainingSessionsFn = async () => {
    setCheckingSession(true)
    setSessionError(false)
    try {
      const response = await fetch("/api/ai/check-sessions")
      if (response.ok) {
        const data = await response.json()
        setSessionInfo(data)
      } else {
        setSessionError(true)
        setSessionInfo({
          remaining_sessions: 2,
          max_sessions: 2,
          can_ask: true,
        })
      }
    } catch (error) {
      console.error("Error checking sessions:", error)
      setSessionError(true)
      setSessionInfo({
        remaining_sessions: 2,
        max_sessions: 2,
        can_ask: true,
      })
    } finally {
      setCheckingSession(false)
    }
  }

  const handleAsk = async () => {
    if (!question.trim() || isLoading) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stickId,
          stickType,
          question: question.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to get answer")
      }

      const data = await response.json()
      setAnswer(data.answer)
      setHasAsked(true)

      // Update session info
      if (sessionInfo) {
        setSessionInfo({
          ...sessionInfo,
          remaining_sessions: Math.max(0, sessionInfo.remaining_sessions - 1),
          can_ask: sessionInfo.remaining_sessions - 1 > 0,
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to get answer")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeep = async () => {
    try {
      const response = await fetch("/api/ai/keep-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stickId,
          stickType,
          question: question.trim(),
          answer,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save answer")
      }

      toast.success("Answer saved to stick details")
      onAnswerKept?.()
      handleClose()
    } catch (error) {
      toast.error("Failed to save answer")
    }
  }

  const handleClose = () => {
    setQuestion("")
    setAnswer("")
    setHasAsked(false)
    onOpenChange(false)
  }

  const isTextareaEnabled = !isLoading && (checkingSession || sessionError || sessionInfo?.can_ask)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Ask AI a Question
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Session info */}
          {!checkingSession && sessionInfo && !sessionError && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Daily sessions remaining:</span>
              <Badge variant={sessionInfo.can_ask ? "default" : "destructive"}>
                {sessionInfo.remaining_sessions} / {sessionInfo.max_sessions}
              </Badge>
            </div>
          )}

          {checkingSession && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking session availability...
            </div>
          )}

          {/* Question input */}
          {!hasAsked && (
            <>
              <div className="space-y-2">
                <span className="text-sm font-medium">Your question (max 200 characters)</span>
                <Textarea
                  placeholder="Ask any question..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
                  className="resize-none"
                  rows={3}
                  disabled={!isTextareaEnabled}
                  aria-label="Your question"
                />
                <div className="text-xs text-muted-foreground text-right">{question.length}/200</div>
              </div>

              {!sessionInfo?.can_ask && !checkingSession && !sessionError && (
                <p className="text-sm text-destructive">
                  You have reached your daily limit of AI questions. Try again tomorrow.
                </p>
              )}

              <Button
                onClick={handleAsk}
                disabled={!question.trim() || isLoading || (!sessionInfo?.can_ask && !sessionError)}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Getting answer...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Answer
                  </>
                )}
              </Button>
            </>
          )}

          {/* Answer display */}
          {hasAsked && answer && (
            <>
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">Your question:</span>
                <p className="text-sm bg-muted p-3 rounded-md">{question}</p>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">AI Answer:</span>
                <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 p-4 rounded-md max-h-60 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{answer}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleKeep} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Check className="h-4 w-4 mr-2" />
                  Keep
                </Button>
                <Button onClick={handleClose} variant="outline" className="flex-1 bg-transparent">
                  <X className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
