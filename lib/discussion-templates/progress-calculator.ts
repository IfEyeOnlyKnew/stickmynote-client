import type {
  DiscussionTemplate,
  RequiredCategory,
  CategoryChecklistItem,
  GuidedPrompt,
  Milestone,
  MilestoneState,
  TemplateProgress,
} from "@/types/discussion-templates"

/**
 * Reply interface for progress calculation
 */
interface Reply {
  id: string
  category?: string | null
  parent_reply_id?: string | null
  created_at: string
}

/**
 * Calculate the progress of a discussion template based on current replies
 */
export function calculateTemplateProgress(
  template: DiscussionTemplate,
  replies: Reply[]
): TemplateProgress {
  // Filter to only root-level replies (not nested replies)
  const rootReplies = replies.filter((r) => !r.parent_reply_id)

  // Build checklist state by counting replies per category
  const checklist: Record<string, CategoryChecklistItem> = {}

  for (const reply of rootReplies) {
    const category = reply.category || "Default"
    if (!checklist[category]) {
      checklist[category] = {
        count: 0,
        fulfilled: false,
        replyIds: [],
      }
    }
    checklist[category].count++
    checklist[category].replyIds.push(reply.id)
    if (!checklist[category].firstAt) {
      checklist[category].firstAt = reply.created_at
    }
  }

  // Check required categories
  const fulfilledCategories: string[] = []
  const missingCategories: RequiredCategory[] = []

  for (const req of template.required_categories) {
    const state = checklist[req.category]
    if (state && state.count >= req.minCount) {
      state.fulfilled = true
      fulfilledCategories.push(req.category)
    } else {
      missingCategories.push(req)
    }
  }

  // Calculate completion percentage
  const totalRequired = template.required_categories.length
  const completionPercentage =
    totalRequired > 0 ? Math.round((fulfilledCategories.length / totalRequired) * 100) : 100

  // Generate guided prompts
  const suggestedPrompts = generateGuidedPrompts(template, checklist, fulfilledCategories)

  // Check milestones
  const milestonesWithState = checkMilestones(template.milestones, checklist, rootReplies)

  // Determine if discussion can be resolved
  const canResolve = missingCategories.length === 0
  const blockingReasons = missingCategories.map((m) => {
    const current = checklist[m.category]?.count || 0
    return `Missing: ${m.category} (need ${m.minCount}, have ${current})`
  })

  return {
    templateId: template.id,
    templateName: template.name,
    goalText: template.goal_text,
    completionPercentage,
    fulfilledCategories,
    missingCategories,
    suggestedPrompts,
    milestones: milestonesWithState,
    canResolve,
    blockingReasons,
  }
}

/**
 * Generate guided prompts based on template configuration and current state
 */
function shouldSuggestOptional(
  opt: { category: string; suggestWhen?: string; suggestAfter?: string },
  checklist: Record<string, CategoryChecklistItem>,
  fulfilledCategories: string[],
  requiredCount: number,
): boolean {
  const hasCategory = !!checklist[opt.category]?.count
  if (hasCategory) return false

  switch (opt.suggestWhen) {
    case "always":
    case "missing":
      return true
    case "after_required":
      return fulfilledCategories.length === requiredCount
    default:
      return !!opt.suggestAfter && !!checklist[opt.suggestAfter]?.count
  }
}

function addNextFlowPrompt(
  flow: Array<{ category: string; step: number; label: string; description?: string }>,
  checklist: Record<string, CategoryChecklistItem>,
  prompts: GuidedPrompt[],
): void {
  for (const step of flow) {
    if (checklist[step.category]?.count) continue
    const alreadySuggested = prompts.some((p) => p.category === step.category)
    if (!alreadySuggested) {
      prompts.push({
        category: step.category,
        prompt: step.description || `Step ${step.step}: ${step.label}`,
        priority: "low",
        reason: "flow",
      })
    }
    break // Only suggest the next step
  }
}

function generateGuidedPrompts(
  template: DiscussionTemplate,
  checklist: Record<string, CategoryChecklistItem>,
  fulfilledCategories: string[]
): GuidedPrompt[] {
  const prompts: GuidedPrompt[] = []

  // Add prompts for missing required categories (high priority)
  for (const req of template.required_categories) {
    if (!fulfilledCategories.includes(req.category)) {
      prompts.push({
        category: req.category,
        prompt: req.description || `Add a ${req.category} reply`,
        priority: "high",
        reason: "required",
      })
    }
  }

  // Add prompts for optional categories based on triggers
  for (const opt of template.optional_categories) {
    if (!shouldSuggestOptional(opt, checklist, fulfilledCategories, template.required_categories.length)) continue
    prompts.push({
      category: opt.category,
      prompt: opt.prompt,
      priority: "medium",
      reason: "suggested",
    })
  }

  // Add prompts based on category flow (low priority)
  if (template.category_flow.length > 0) {
    addNextFlowPrompt(template.category_flow, checklist, prompts)
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  prompts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return prompts
}

/**
 * Check if a single milestone has been reached
 */
function isMilestoneReached(
  milestone: Milestone,
  checklist: Record<string, CategoryChecklistItem>,
  replyCount: number,
): boolean {
  const triggersMet = milestone.triggerCategories.every(
    (cat) => checklist[cat]?.count > 0
  )
  const minRepliesMet = !milestone.minReplies || replyCount >= milestone.minReplies
  const requiredMet =
    !milestone.requiredCategories ||
    milestone.requiredCategories.every((cat) => checklist[cat]?.fulfilled)

  return triggersMet && minRepliesMet && requiredMet
}

/**
 * Build the state for a reached milestone
 */
function buildReachedState(
  milestone: Milestone,
  checklist: Record<string, CategoryChecklistItem>,
): MilestoneState {
  const state: MilestoneState = { reached: true }

  const triggerTimestamps = milestone.triggerCategories
    .map((cat) => checklist[cat]?.firstAt)
    .filter((t): t is string => Boolean(t))
    .sort((a, b) => a.localeCompare(b))

  if (triggerTimestamps.length > 0) {
    state.reachedAt = triggerTimestamps.at(-1)!
  }

  const lastTriggerCategory = milestone.triggerCategories.at(-1)!
  const triggerReplyId = checklist[lastTriggerCategory]?.replyIds?.[0]
  if (triggerReplyId) {
    state.triggeredBy = triggerReplyId
  }

  return state
}

/**
 * Check milestone status based on current replies
 */
function checkMilestones(
  milestones: Milestone[],
  checklist: Record<string, CategoryChecklistItem>,
  replies: Reply[]
): Array<Milestone & { state: MilestoneState }> {
  return milestones.map((milestone) => {
    const reached = isMilestoneReached(milestone, checklist, replies.length)
    const state = reached
      ? buildReachedState(milestone, checklist)
      : { reached: false }

    return { ...milestone, state }
  })
}

/**
 * Recalculate checklist state after a reply is added or removed
 */
export function updateChecklistState(
  currentState: Record<string, CategoryChecklistItem>,
  replies: Reply[]
): Record<string, CategoryChecklistItem> {
  const rootReplies = replies.filter((r) => !r.parent_reply_id)
  const newState: Record<string, CategoryChecklistItem> = {}

  for (const reply of rootReplies) {
    const category = reply.category || "Default"
    if (!newState[category]) {
      newState[category] = {
        count: 0,
        fulfilled: false, // Will be determined by template requirements
        replyIds: [],
      }
    }
    newState[category].count++
    newState[category].replyIds.push(reply.id)
    if (!newState[category].firstAt) {
      newState[category].firstAt = reply.created_at
    }
  }

  return newState
}

/**
 * Check if a discussion can be resolved based on template requirements
 */
export function canResolveDiscussion(
  template: DiscussionTemplate,
  replies: Reply[]
): { canResolve: boolean; blockingReasons: string[] } {
  const progress = calculateTemplateProgress(template, replies)
  return {
    canResolve: progress.canResolve,
    blockingReasons: progress.blockingReasons,
  }
}

/**
 * Get the completion percentage for a specific category
 */
export function getCategoryCompletion(
  template: DiscussionTemplate,
  category: string,
  replies: Reply[]
): { current: number; required: number; percentage: number } {
  const rootReplies = replies.filter((r) => !r.parent_reply_id)
  const categoryReplies = rootReplies.filter(
    (r) => (r.category || "Default") === category
  )

  const requirement = template.required_categories.find((r) => r.category === category)
  const required = requirement?.minCount || 0

  return {
    current: categoryReplies.length,
    required,
    percentage: required > 0 ? Math.min(100, Math.round((categoryReplies.length / required) * 100)) : 100,
  }
}
