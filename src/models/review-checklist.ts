import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for a single review checklist item definition.
 */
export const ChecklistItemSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
})

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>

/**
 * Schema for a full review checklist (array of items).
 */
export const ReviewChecklistSchema = z.array(ChecklistItemSchema)

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

/**
 * A single checklist item with its checked/unchecked state.
 */
export interface ChecklistStateItem {
  readonly label: string
  readonly description?: string
  readonly checked: boolean
}

/**
 * Runtime state of a review checklist, tracking which items are checked.
 */
export interface ChecklistState {
  readonly items: readonly ChecklistStateItem[]
}

/**
 * Completion summary for display purposes.
 */
export interface CompletionSummary {
  readonly checked: number
  readonly total: number
  readonly percent: number
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Initialize a checklist state from item definitions.
 * All items start unchecked.
 */
export function createChecklistState(
  items: readonly ChecklistItem[],
): ChecklistState {
  return {
    items: items.map((item) => ({
      label: item.label,
      description: item.description,
      checked: false,
    })),
  }
}

/**
 * Toggle the checked state of an item at the given index.
 * Returns a new state object (immutable). Returns the same state
 * if the index is out of bounds.
 */
export function toggleItem(
  state: ChecklistState,
  index: number,
): ChecklistState {
  if (index < 0 || index >= state.items.length) {
    return state
  }

  return {
    items: state.items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item,
    ),
  }
}

/**
 * Compute a completion summary for the checklist.
 * Empty checklists are considered 100% complete.
 */
export function completionSummary(state: ChecklistState): CompletionSummary {
  const total = state.items.length
  if (total === 0) {
    return { checked: 0, total: 0, percent: 100 }
  }

  const checked = state.items.filter((item) => item.checked).length
  const percent = (checked / total) * 100

  return { checked, total, percent }
}

/**
 * Check whether all items in the checklist are checked.
 * An empty checklist is considered complete.
 */
export function isComplete(state: ChecklistState): boolean {
  return state.items.every((item) => item.checked)
}
