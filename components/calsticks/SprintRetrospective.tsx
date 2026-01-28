"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ThumbsUp,
  Lightbulb,
  CheckSquare,
  Plus,
  Trash2,
  MoreVertical,
  Loader2,
  MessageSquare,
  Target,
  Smile,
  Meh,
  Frown,
  PartyPopper,
  AlertTriangle,
  Check,
  X,
  Edit2,
  Calendar,
  User,
  Sparkles,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"
import type {
  Sprint,
  SprintRetrospective as RetrospectiveType,
  RetrospectiveItem,
  ActionItem,
  RetrospectiveStatus,
} from "@/types/sprint"
import { cn } from "@/lib/utils"

interface SprintRetrospectiveProps {
  readonly sprintId: string
  readonly sprint?: Sprint
  readonly onClose?: () => void
  readonly className?: string
}

const MOOD_OPTIONS = [
  { value: 1, icon: Frown, label: "Very Unhappy", color: "text-red-500" },
  { value: 2, icon: Frown, label: "Unhappy", color: "text-orange-500" },
  { value: 3, icon: Meh, label: "Neutral", color: "text-yellow-500" },
  { value: 4, icon: Smile, label: "Happy", color: "text-lime-500" },
  { value: 5, icon: PartyPopper, label: "Very Happy", color: "text-green-500" },
]

// Helper to get retrospective status label
function getRetrospectiveStatusLabel(isCompleted: boolean, status: RetrospectiveStatus | undefined): string {
  if (isCompleted) return "Completed"
  if (status === "in_progress") return "In Progress"
  return "Draft"
}

interface ItemCardProps {
  readonly item: RetrospectiveItem
  readonly type: "went_well" | "to_improve"
  readonly onVote: (id: string) => void
  readonly onDelete: (id: string) => void
  readonly onEdit: (id: string, text: string) => void
  readonly disabled?: boolean
}

function ItemCard({ item, type, onVote, onDelete, onEdit, disabled }: ItemCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(item.id, editText.trim())
      setIsEditing(false)
    }
  }

  const bgColor = type === "went_well" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
  const iconColor = type === "went_well" ? "text-green-600" : "text-amber-600"

  return (
    <div className={cn("p-3 rounded-lg border", bgColor)}>
      {isEditing ? (
        <div className="space-y-2">
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
          />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="text-sm">{item.text}</p>
            {item.author_name && (
              <p className="text-xs text-muted-foreground mt-1">— {item.author_name}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn("h-7 px-2", iconColor)}
                    onClick={() => onVote(item.id)}
                    disabled={disabled}
                  >
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    {item.votes || 0}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vote for this item</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {!disabled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-3 w-3 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(item.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface ActionItemCardProps {
  readonly item: ActionItem
  readonly onToggleComplete: (id: string) => void
  readonly onDelete: (id: string) => void
  readonly onEdit: (id: string, updates: Partial<ActionItem>) => void
  readonly disabled?: boolean
}

function ActionItemCard({ item, onToggleComplete, onDelete, onEdit, disabled }: ActionItemCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(item.id, { text: editText.trim() })
      setIsEditing(false)
    }
  }

  return (
    <div className={cn(
      "p-3 rounded-lg border",
      item.completed ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-200"
    )}>
      {isEditing ? (
        <div className="space-y-2">
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
          />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => onToggleComplete(item.id)}
            disabled={disabled}
            className="mt-0.5"
            aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
          >
            <CheckSquare
              className={cn(
                "h-4 w-4",
                item.completed ? "text-green-600 fill-green-100" : "text-blue-400"
              )}
            />
          </button>
          <div className="flex-1">
            <p className={cn("text-sm", item.completed && "line-through text-muted-foreground")}>
              {item.text}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {item.assignee_name && (
                <Badge variant="secondary" className="text-xs">
                  <User className="h-2 w-2 mr-1" />
                  {item.assignee_name}
                </Badge>
              )}
              {item.due_date && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-2 w-2 mr-1" />
                  {format(parseISO(item.due_date), "MMM d")}
                </Badge>
              )}
            </div>
          </div>
          {!disabled && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-3 w-3 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  )
}

export function SprintRetrospective({ sprintId, sprint, onClose, className }: SprintRetrospectiveProps) {
  const [retrospective, setRetrospective] = useState<RetrospectiveType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newWentWell, setNewWentWell] = useState("")
  const [newToImprove, setNewToImprove] = useState("")
  const [newActionItem, setNewActionItem] = useState("")
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [meetingNotes, setMeetingNotes] = useState("")
  const { toast } = useToast()

  const isCompleted = retrospective?.status === "completed"

  const fetchRetrospective = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/calsticks/sprints/${sprintId}/retrospective`)

      if (!response.ok) {
        throw new Error("Failed to fetch retrospective")
      }

      const data = await response.json()
      if (data.retrospective) {
        setRetrospective(data.retrospective)
        setSelectedMood(data.retrospective.team_mood_score || null)
        setMeetingNotes(data.retrospective.meeting_notes || "")
      }
    } catch (error) {
      console.error("Error fetching retrospective:", error)
    } finally {
      setLoading(false)
    }
  }, [sprintId])

  useEffect(() => {
    fetchRetrospective()
  }, [fetchRetrospective])

  const createRetrospective = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/calsticks/sprints/${sprintId}/retrospective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_date: new Date().toISOString() }),
      })

      if (!response.ok) {
        throw new Error("Failed to create retrospective")
      }

      const data = await response.json()
      setRetrospective(data.retrospective)
      toast({
        title: "Retrospective started",
        description: "You can now add items and collaborate with your team",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to start retrospective",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateRetrospective = async (updates: Partial<RetrospectiveType>) => {
    if (!retrospective) return

    try {
      setSaving(true)
      const response = await fetch(`/api/calsticks/sprints/${sprintId}/retrospective`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error("Failed to update retrospective")
      }

      const data = await response.json()
      setRetrospective(data.retrospective)
    } catch {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const addItem = async (type: "went_well" | "to_improve", text: string) => {
    if (!retrospective || !text.trim()) return

    const newItem: RetrospectiveItem = {
      id: crypto.randomUUID(),
      text: text.trim(),
      votes: 0,
      created_at: new Date().toISOString(),
    }

    const updatedItems = [...(retrospective[type] || []), newItem]
    await updateRetrospective({ [type]: updatedItems })

    if (type === "went_well") setNewWentWell("")
    else setNewToImprove("")
  }

  const addActionItem = async (text: string) => {
    if (!retrospective || !text.trim()) return

    const newItem: ActionItem = {
      id: crypto.randomUUID(),
      text: text.trim(),
      completed: false,
      created_at: new Date().toISOString(),
    }

    const updatedItems = [...(retrospective.action_items || []), newItem]
    await updateRetrospective({ action_items: updatedItems })
    setNewActionItem("")
  }

  const voteItem = async (type: "went_well" | "to_improve", itemId: string) => {
    if (!retrospective) return

    const items = retrospective[type] || []
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, votes: (item.votes || 0) + 1 } : item
    )
    await updateRetrospective({ [type]: updatedItems })
  }

  const deleteItem = async (type: "went_well" | "to_improve" | "action_items", itemId: string) => {
    if (!retrospective) return

    const items = retrospective[type] || []
    const updatedItems = items.filter((item) => item.id !== itemId)
    await updateRetrospective({ [type]: updatedItems })
  }

  const editItem = async (type: "went_well" | "to_improve", itemId: string, text: string) => {
    if (!retrospective) return

    const items = retrospective[type] || []
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, text } : item
    )
    await updateRetrospective({ [type]: updatedItems })
  }

  const editActionItem = async (itemId: string, updates: Partial<ActionItem>) => {
    if (!retrospective) return

    const items = retrospective.action_items || []
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    )
    await updateRetrospective({ action_items: updatedItems })
  }

  const toggleActionItemComplete = async (itemId: string) => {
    if (!retrospective) return

    const items = retrospective.action_items || []
    const updatedItems = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
            completed_at: item.completed ? undefined : new Date().toISOString(),
          }
        : item
    )
    await updateRetrospective({ action_items: updatedItems })
  }

  const setMood = async (mood: number) => {
    setSelectedMood(mood)
    await updateRetrospective({ team_mood_score: mood })
  }

  const saveMeetingNotes = async () => {
    await updateRetrospective({ meeting_notes: meetingNotes })
    toast({ title: "Notes saved" })
  }

  const completeRetrospective = async () => {
    await updateRetrospective({ status: "completed" as RetrospectiveStatus })
    toast({
      title: "Retrospective completed",
      description: "Great job! Action items have been captured.",
    })
  }

  // Calculate statistics
  const wentWellCount = retrospective?.went_well?.length || 0
  const toImproveCount = retrospective?.to_improve?.length || 0
  const actionItemsCount = retrospective?.action_items?.length || 0
  const completedActionsCount = retrospective?.action_items?.filter((a) => a.completed).length || 0
  const totalVotes =
    (retrospective?.went_well?.reduce((sum, i) => sum + (i.votes || 0), 0) || 0) +
    (retrospective?.to_improve?.reduce((sum, i) => sum + (i.votes || 0), 0) || 0)

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!retrospective) {
    return (
      <Card className={className}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Sprint Retrospective</CardTitle>
          <CardDescription>
            {sprint
              ? `Reflect on ${sprint.name} and capture learnings for the team`
              : "Start a retrospective to capture what went well and what to improve"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={createRetrospective} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <MessageSquare className="h-4 w-4 mr-2" />
            Start Retrospective
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Sprint Retrospective
            </CardTitle>
            <CardDescription>
              {sprint?.name || "Sprint"} • {format(parseISO(retrospective.created_at), "MMM d, yyyy")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isCompleted ? "default" : "secondary"}>
              {getRetrospectiveStatusLabel(isCompleted, retrospective.status)}
            </Badge>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <ThumbsUp className="h-4 w-4 mx-auto text-green-600" />
            <div className="text-lg font-bold text-green-700">{wentWellCount}</div>
            <div className="text-xs text-green-600">Went Well</div>
          </div>
          <div className="text-center p-2 bg-amber-50 rounded-lg">
            <AlertTriangle className="h-4 w-4 mx-auto text-amber-600" />
            <div className="text-lg font-bold text-amber-700">{toImproveCount}</div>
            <div className="text-xs text-amber-600">To Improve</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <CheckSquare className="h-4 w-4 mx-auto text-blue-600" />
            <div className="text-lg font-bold text-blue-700">
              {completedActionsCount}/{actionItemsCount}
            </div>
            <div className="text-xs text-blue-600">Actions</div>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <ThumbsUp className="h-4 w-4 mx-auto text-purple-600" />
            <div className="text-lg font-bold text-purple-700">{totalVotes}</div>
            <div className="text-xs text-purple-600">Votes</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            {/* Team Mood */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Smile className="h-4 w-4" />
                How does the team feel?
              </h4>
              <div className="flex gap-2">
                {MOOD_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <TooltipProvider key={option.value}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={selectedMood === option.value ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "h-10 w-10 p-0",
                              selectedMood === option.value && option.color
                            )}
                            onClick={() => setMood(option.value)}
                            disabled={isCompleted}
                          >
                            <Icon className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{option.label}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* What Went Well */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-green-700">
                <ThumbsUp className="h-4 w-4" />
                What went well?
              </h4>
              <div className="space-y-2">
                {retrospective.went_well?.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    type="went_well"
                    onVote={(id) => voteItem("went_well", id)}
                    onDelete={(id) => deleteItem("went_well", id)}
                    onEdit={(id, text) => editItem("went_well", id, text)}
                    disabled={isCompleted}
                  />
                ))}
                {!isCompleted && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add something that went well..."
                      value={newWentWell}
                      onChange={(e) => setNewWentWell(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addItem("went_well", newWentWell)}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => addItem("went_well", newWentWell)}
                      disabled={!newWentWell.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* What to Improve */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-amber-700">
                <Lightbulb className="h-4 w-4" />
                What can we improve?
              </h4>
              <div className="space-y-2">
                {retrospective.to_improve?.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    type="to_improve"
                    onVote={(id) => voteItem("to_improve", id)}
                    onDelete={(id) => deleteItem("to_improve", id)}
                    onEdit={(id, text) => editItem("to_improve", id, text)}
                    disabled={isCompleted}
                  />
                ))}
                {!isCompleted && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add something to improve..."
                      value={newToImprove}
                      onChange={(e) => setNewToImprove(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addItem("to_improve", newToImprove)}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => addItem("to_improve", newToImprove)}
                      disabled={!newToImprove.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Action Items */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-blue-700">
                <Target className="h-4 w-4" />
                Action Items
              </h4>
              {actionItemsCount > 0 && (
                <Progress
                  value={(completedActionsCount / actionItemsCount) * 100}
                  className="h-2 mb-3"
                />
              )}
              <div className="space-y-2">
                {retrospective.action_items?.map((item) => (
                  <ActionItemCard
                    key={item.id}
                    item={item}
                    onToggleComplete={toggleActionItemComplete}
                    onDelete={(id) => deleteItem("action_items", id)}
                    onEdit={editActionItem}
                    disabled={isCompleted}
                  />
                ))}
                {!isCompleted && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add an action item..."
                      value={newActionItem}
                      onChange={(e) => setNewActionItem(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addActionItem(newActionItem)}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => addActionItem(newActionItem)}
                      disabled={!newActionItem.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Meeting Notes */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Edit2 className="h-4 w-4" />
                Meeting Notes
              </h4>
              <Textarea
                placeholder="Additional notes from the retrospective..."
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                disabled={isCompleted}
                rows={3}
              />
              {!isCompleted && meetingNotes !== retrospective.meeting_notes && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={saveMeetingNotes}
                >
                  Save Notes
                </Button>
              )}
            </div>

            {/* Complete Button */}
            {!isCompleted && (
              <div className="pt-4 border-t">
                <Button
                  className="w-full"
                  onClick={completeRetrospective}
                  disabled={saving}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Complete Retrospective
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
