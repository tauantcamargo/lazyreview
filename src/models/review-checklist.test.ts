import { describe, it, expect } from 'vitest'
import {
  ChecklistItemSchema,
  ReviewChecklistSchema,
  createChecklistState,
  toggleItem,
  completionSummary,
  isComplete,
  type ChecklistItem,
  type ChecklistState,
} from './review-checklist'

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe('ChecklistItemSchema', () => {
  it('should validate a minimal item with label only', () => {
    const result = ChecklistItemSchema.safeParse({ label: 'Check tests' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.label).toBe('Check tests')
      expect(result.data.description).toBeUndefined()
    }
  })

  it('should validate an item with label and description', () => {
    const result = ChecklistItemSchema.safeParse({
      label: 'Security review',
      description: 'Verify no secrets are exposed',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.label).toBe('Security review')
      expect(result.data.description).toBe('Verify no secrets are exposed')
    }
  })

  it('should reject an item without a label', () => {
    const result = ChecklistItemSchema.safeParse({ description: 'orphaned' })
    expect(result.success).toBe(false)
  })

  it('should reject an item with empty label', () => {
    const result = ChecklistItemSchema.safeParse({ label: '' })
    expect(result.success).toBe(false)
  })

  it('should allow empty description', () => {
    const result = ChecklistItemSchema.safeParse({
      label: 'Item',
      description: '',
    })
    expect(result.success).toBe(true)
  })

  it('should reject non-string label', () => {
    const result = ChecklistItemSchema.safeParse({ label: 123 })
    expect(result.success).toBe(false)
  })
})

describe('ReviewChecklistSchema', () => {
  it('should validate an array of checklist items', () => {
    const result = ReviewChecklistSchema.safeParse([
      { label: 'Item 1' },
      { label: 'Item 2', description: 'Desc' },
    ])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
    }
  })

  it('should validate an empty array', () => {
    const result = ReviewChecklistSchema.safeParse([])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(0)
    }
  })

  it('should reject non-array input', () => {
    const result = ReviewChecklistSchema.safeParse('not an array')
    expect(result.success).toBe(false)
  })

  it('should reject array with invalid items', () => {
    const result = ReviewChecklistSchema.safeParse([
      { label: 'Valid' },
      { notALabel: 'Invalid' },
    ])
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createChecklistState
// ---------------------------------------------------------------------------

describe('createChecklistState', () => {
  it('should initialize all items as unchecked', () => {
    const items: readonly ChecklistItem[] = [
      { label: 'Tests pass' },
      { label: 'No console.log' },
    ]
    const state = createChecklistState(items)
    expect(state.items).toHaveLength(2)
    expect(state.items[0]!.checked).toBe(false)
    expect(state.items[1]!.checked).toBe(false)
  })

  it('should preserve labels and descriptions', () => {
    const items: readonly ChecklistItem[] = [
      { label: 'Tests', description: 'Run pnpm test' },
      { label: 'Types' },
    ]
    const state = createChecklistState(items)
    expect(state.items[0]!.label).toBe('Tests')
    expect(state.items[0]!.description).toBe('Run pnpm test')
    expect(state.items[1]!.label).toBe('Types')
    expect(state.items[1]!.description).toBeUndefined()
  })

  it('should return empty items for empty input', () => {
    const state = createChecklistState([])
    expect(state.items).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// toggleItem
// ---------------------------------------------------------------------------

describe('toggleItem', () => {
  it('should toggle unchecked item to checked', () => {
    const state = createChecklistState([{ label: 'A' }, { label: 'B' }])
    const newState = toggleItem(state, 0)
    expect(newState.items[0]!.checked).toBe(true)
    expect(newState.items[1]!.checked).toBe(false)
  })

  it('should toggle checked item to unchecked', () => {
    const state = createChecklistState([{ label: 'A' }])
    const checked = toggleItem(state, 0)
    const unchecked = toggleItem(checked, 0)
    expect(unchecked.items[0]!.checked).toBe(false)
  })

  it('should return same state for out-of-bounds index', () => {
    const state = createChecklistState([{ label: 'A' }])
    const result = toggleItem(state, 5)
    expect(result).toBe(state)
  })

  it('should return same state for negative index', () => {
    const state = createChecklistState([{ label: 'A' }])
    const result = toggleItem(state, -1)
    expect(result).toBe(state)
  })

  it('should not mutate the original state', () => {
    const state = createChecklistState([{ label: 'A' }])
    const newState = toggleItem(state, 0)
    expect(state.items[0]!.checked).toBe(false)
    expect(newState.items[0]!.checked).toBe(true)
    expect(newState).not.toBe(state)
  })

  it('should preserve other items when toggling one', () => {
    const state = createChecklistState([
      { label: 'A', description: 'desc A' },
      { label: 'B', description: 'desc B' },
      { label: 'C' },
    ])
    const newState = toggleItem(state, 1)
    expect(newState.items[0]!.label).toBe('A')
    expect(newState.items[0]!.description).toBe('desc A')
    expect(newState.items[0]!.checked).toBe(false)
    expect(newState.items[1]!.checked).toBe(true)
    expect(newState.items[2]!.label).toBe('C')
    expect(newState.items[2]!.checked).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// completionSummary
// ---------------------------------------------------------------------------

describe('completionSummary', () => {
  it('should return zero for empty checklist', () => {
    const state = createChecklistState([])
    const summary = completionSummary(state)
    expect(summary.checked).toBe(0)
    expect(summary.total).toBe(0)
    expect(summary.percent).toBe(100)
  })

  it('should count checked items', () => {
    let state = createChecklistState([
      { label: 'A' },
      { label: 'B' },
      { label: 'C' },
    ])
    state = toggleItem(state, 0)
    state = toggleItem(state, 2)
    const summary = completionSummary(state)
    expect(summary.checked).toBe(2)
    expect(summary.total).toBe(3)
    expect(summary.percent).toBeCloseTo(66.67, 1)
  })

  it('should return 100% when all checked', () => {
    let state = createChecklistState([{ label: 'A' }, { label: 'B' }])
    state = toggleItem(state, 0)
    state = toggleItem(state, 1)
    const summary = completionSummary(state)
    expect(summary.checked).toBe(2)
    expect(summary.total).toBe(2)
    expect(summary.percent).toBe(100)
  })

  it('should return 0% when none checked', () => {
    const state = createChecklistState([{ label: 'A' }, { label: 'B' }])
    const summary = completionSummary(state)
    expect(summary.checked).toBe(0)
    expect(summary.total).toBe(2)
    expect(summary.percent).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// isComplete
// ---------------------------------------------------------------------------

describe('isComplete', () => {
  it('should return true for empty checklist', () => {
    const state = createChecklistState([])
    expect(isComplete(state)).toBe(true)
  })

  it('should return false when not all items checked', () => {
    let state = createChecklistState([{ label: 'A' }, { label: 'B' }])
    state = toggleItem(state, 0)
    expect(isComplete(state)).toBe(false)
  })

  it('should return true when all items checked', () => {
    let state = createChecklistState([{ label: 'A' }, { label: 'B' }])
    state = toggleItem(state, 0)
    state = toggleItem(state, 1)
    expect(isComplete(state)).toBe(true)
  })

  it('should return false for single unchecked item', () => {
    const state = createChecklistState([{ label: 'A' }])
    expect(isComplete(state)).toBe(false)
  })

  it('should return true for single checked item', () => {
    let state = createChecklistState([{ label: 'A' }])
    state = toggleItem(state, 0)
    expect(isComplete(state)).toBe(true)
  })
})
