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
    // Check if we should suggest this category
    let shouldSuggest = false

    switch (opt.suggestWhen) {
      case "always":
        // Always suggest if not already present
        shouldSuggest = !checklist[opt.category]?.count
        break

      case "missing":
        // Suggest if category is missing
        shouldSuggest = !checklist[opt.category]?.count
        break

      case "after_required":
        // Suggest after all required categories are fulfilled
        shouldSuggest =
          fulfilledCategories.length === template.required_categories.length &&
          !checklist[opt.category]?.count
        break

      default:
        // Check suggestAfter trigger
        if (opt.suggestAfter) {
          shouldSuggest =
            checklist[opt.suggestAfter]?.count > 0 && !checklist[opt.category]?.count
        }
    }

    if (shouldSuggest) {
      prompts.push({
        category: opt.category,
        prompt: opt.prompt,
        priority: "medium",
        reason: "suggested",
      })
    }
  }

  // Add prompts based on category flow (low priority)
  if (template.category_flow.length > 0) {
    // Find the next step in the flow that hasn't been completed
    for (const step of template.category_flow) {
      if (!checklist[step.category]?.count) {
        // Only add if not already suggested
        const alreadySuggested = prompts.some((p) => p.category === step.category)
        if (!alreadySuggested) {
          prompts.push({
            category: step.category,
            prompt: step.description || `Step ${step.step}: ${step.label}`,
            priority: "low",
            reason: "flow",
          })
        }
        // Only suggest the next step, not all remaining steps
        break
      }
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  prompts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return prompts
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
    const state: MilestoneState = {
      reached: false,
    }

    // Check if all trigger categories have replies
    const triggersMet = milestone.triggerCategories.every(
      (cat) => checklist[cat]?.count > 0
    )

    // Check if minimum replies requirement is met
    const minRepliesMet = !milestone.minReplies || replies.length >= milestone.minReplies

    // Check if required categories are fulfilled (if specified)
    const requiredMet =
      !milestone.requiredCategories ||
      milestone.requiredCategories.every((cat) => checklist[cat]?.fulfilled)

    if (triggersMet && minRepliesMet && requiredMet) {
      state.reached = true

      // Find the earliest timestamp when the milestone was reached
      const triggerTimestamps = milestone.triggerCategories
        .map((cat) => checklist[cat]?.firstAt)
        .filter(Boolean)
        .sort()

      if (triggerTimestamps.length > 0) {
        state.reachedAt = triggerTimestamps[triggerTimestamps.length - 1]
      }

      // Find the reply that triggered the milestone
      const lastTriggerCategory =
        milestone.triggerCategories[milestone.triggerCategories.length - 1]
      const triggerReplyId = checklist[lastTriggerCategory]?.replyIds?.[0]
      if (triggerReplyId) {
        state.triggeredBy = triggerReplyId
      }
    }

    return {
      ...milestone,
      state,
    }
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
