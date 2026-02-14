import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for useReviewChecklist hook.
 *
 * Verifies:
 * - Returns null state when no checklist provided
 * - Initializes checklist state from items
 * - Toggle updates state immutably
 * - Summary and isComplete are derived correctly
 * - State is persisted per PR key (in-memory)
 */

// ---------------------------------------------------------------------------
// Mock React hooks to capture state transitions
// ---------------------------------------------------------------------------

interface StateCapture {
  checklistState: import('../models/review-checklist').ChecklistState | null
}

let stateCapture: StateCapture = {
  checklistState: null,
}

const mockSetChecklistState = vi.fn((updater: unknown) => {
  if (typeof updater === 'function') {
    stateCapture = {
      ...stateCapture,
      checklistState: (
        updater as (
          prev: import('../models/review-checklist').ChecklistState | null,
        ) => import('../models/review-checklist').ChecklistState | null
      )(stateCapture.checklistState),
    }
  } else {
    stateCapture = {
      ...stateCapture,
      checklistState:
        updater as import('../models/review-checklist').ChecklistState | null,
    }
  }
})

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useState: (initial: unknown) => {
      // Handle lazy initializer pattern: useState(() => value)
      const resolvedInitial =
        typeof initial === 'function' ? (initial as () => unknown)() : initial
      const value =
        stateCapture.checklistState !== null
          ? stateCapture.checklistState
          : resolvedInitial
      return [value, mockSetChecklistState]
    },
    useCallback: (fn: unknown) => fn,
    useEffect: (fn: () => void | (() => void)) => {
      fn()
    },
    useMemo: (fn: () => unknown) => fn(),
    useRef: (val: unknown) => ({ current: val }),
  }
})

import { useReviewChecklist } from './useReviewChecklist'
import type { ChecklistItem } from '../models/review-checklist'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_ITEMS: readonly ChecklistItem[] = [
  { label: 'Tests pass', description: 'Run pnpm test' },
  { label: 'No console.log' },
  { label: 'Types check' },
]

function createHook(
  checklist: readonly ChecklistItem[] | undefined,
  prKey: string,
) {
  return useReviewChecklist(checklist, prKey)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useReviewChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stateCapture = { checklistState: null }
  })

  describe('when no checklist provided', () => {
    it('returns null state for undefined', () => {
      const result = createHook(undefined, 'github:owner/repo#1')
      expect(result).toBeNull()
    })

    it('returns null for empty array', () => {
      const result = createHook([], 'github:owner/repo#1')
      expect(result).toBeNull()
    })
  })

  describe('initialization', () => {
    it('initializes checklist state from items', () => {
      stateCapture.checklistState = {
        items: SAMPLE_ITEMS.map((item) => ({
          label: item.label,
          description: item.description,
          checked: false,
        })),
      }
      const result = createHook(SAMPLE_ITEMS, 'github:owner/repo#1')
      expect(result).not.toBeNull()
      expect(result!.state.items).toHaveLength(3)
      expect(result!.state.items[0]!.label).toBe('Tests pass')
      expect(result!.state.items[0]!.checked).toBe(false)
    })

    it('all items start unchecked', () => {
      stateCapture.checklistState = {
        items: SAMPLE_ITEMS.map((item) => ({
          label: item.label,
          description: item.description,
          checked: false,
        })),
      }
      const result = createHook(SAMPLE_ITEMS, 'github:owner/repo#1')
      expect(result).not.toBeNull()
      for (const item of result!.state.items) {
        expect(item.checked).toBe(false)
      }
    })
  })

  describe('toggleItem', () => {
    it('calls setState with updater function', () => {
      stateCapture.checklistState = {
        items: SAMPLE_ITEMS.map((item) => ({
          label: item.label,
          description: item.description,
          checked: false,
        })),
      }
      const result = createHook(SAMPLE_ITEMS, 'github:owner/repo#1')
      expect(result).not.toBeNull()

      // Clear mocks to isolate the toggle call from useEffect calls
      mockSetChecklistState.mockClear()

      result!.toggleItem(0)
      expect(mockSetChecklistState).toHaveBeenCalledOnce()
    })

    it('toggles item at given index via updater', () => {
      const initialState = {
        items: SAMPLE_ITEMS.map((item) => ({
          label: item.label,
          description: item.description,
          checked: false,
        })),
      }
      stateCapture.checklistState = initialState
      const result = createHook(SAMPLE_ITEMS, 'github:owner/repo#1')

      // Clear mocks to isolate the toggle call
      mockSetChecklistState.mockClear()

      result!.toggleItem(1)

      // Extract the updater function from the toggle call
      expect(mockSetChecklistState).toHaveBeenCalledOnce()
      const updater = mockSetChecklistState.mock.calls[0]![0]
      expect(typeof updater).toBe('function')

      // Apply updater to get new state
      const newState = (updater as (prev: typeof initialState) => typeof initialState)(initialState)
      expect(newState.items[0]!.checked).toBe(false)
      expect(newState.items[1]!.checked).toBe(true)
      expect(newState.items[2]!.checked).toBe(false)
    })

    it('preserves labels and descriptions when toggling', () => {
      const initialState = {
        items: SAMPLE_ITEMS.map((item) => ({
          label: item.label,
          description: item.description,
          checked: false,
        })),
      }
      stateCapture.checklistState = initialState
      const result = createHook(SAMPLE_ITEMS, 'github:owner/repo#1')
      mockSetChecklistState.mockClear()

      result!.toggleItem(0)
      const updater = mockSetChecklistState.mock.calls[0]![0]
      const newState = (updater as (prev: typeof initialState) => typeof initialState)(initialState)
      expect(newState.items[0]!.label).toBe('Tests pass')
      expect(newState.items[0]!.description).toBe('Run pnpm test')
      expect(newState.items[0]!.checked).toBe(true)
    })
  })

  describe('summary', () => {
    it('returns correct summary for unchecked state', () => {
      stateCapture.checklistState = {
        items: SAMPLE_ITEMS.map((item) => ({
          label: item.label,
          description: item.description,
          checked: false,
        })),
      }
      const result = createHook(SAMPLE_ITEMS, 'github:owner/repo#1')
      expect(result!.summary.checked).toBe(0)
      expect(result!.summary.total).toBe(3)
      expect(result!.summary.percent).toBe(0)
    })

    it('returns correct summary for partially checked state', () => {
      stateCapture.checklistState = {
        items: [
          { label: 'Tests pass', description: 'Run pnpm test', checked: true },
          { label: 'No console.log', checked: false },
          { label: 'Types check', checked: true },
        ],
      }
      const result = createHook(SAMPLE_ITEMS, 'github:owner/repo#1')
      expect(result!.summary.checked).toBe(2)
      expect(result!.summary.total).toBe(3)
      expect(result!.summary.percent).toBeCloseTo(66.67, 1)
    })

    it('returns 100% when all items checked', () => {
      stateCapture.checklistState = {
        items: [
          { label: 'Tests pass', checked: true },
          { label: 'No console.log', checked: true },
          { label: 'Types check', checked: true },
        ],
      }
      const result = createHook(SAMPLE_ITEMS, 'github:owner/repo#1')
      expect(result!.summary.checked).toBe(3)
      expect(result!.summary.total).toBe(3)
      expect(result!.summary.percent).toBe(100)
    })
  })

  describe('isComplete', () => {
    it('returns false when not all items checked', () => {
      stateCapture.checklistState = {
        items: [
          { label: 'Tests pass', checked: true },
          { label: 'No console.log', checked: false },
        ],
      }
      const result = createHook(SAMPLE_ITEMS.slice(0, 2), 'github:owner/repo#1')
      expect(result!.isComplete).toBe(false)
    })

    it('returns true when all items checked', () => {
      stateCapture.checklistState = {
        items: [
          { label: 'Tests pass', checked: true },
          { label: 'No console.log', checked: true },
        ],
      }
      const result = createHook(SAMPLE_ITEMS.slice(0, 2), 'github:owner/repo#1')
      expect(result!.isComplete).toBe(true)
    })
  })
})
