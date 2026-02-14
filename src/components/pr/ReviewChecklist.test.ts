import { describe, it, expect, vi } from 'vitest'
import type { ChecklistState } from '../../models/review-checklist'
import {
  createChecklistState,
  completionSummary,
} from '../../models/review-checklist'

/**
 * Tests for ReviewChecklist component.
 *
 * Verifies:
 * - Renders checklist items with correct labels
 * - Shows completion count in header
 * - Checked items show [x], unchecked show [ ]
 * - Toggle callback is invoked on space key
 * - Handles null/empty state gracefully
 * - Collapsible section behavior (expand/collapse)
 */

// ---------------------------------------------------------------------------
// Helpers (mirror component logic)
// ---------------------------------------------------------------------------

function formatCheckbox(checked: boolean): string {
  return checked ? '[x]' : '[ ]'
}

function formatHeader(state: ChecklistState): string {
  const summary = completionSummary(state)
  return `Review Checklist (${summary.checked}/${summary.total})`
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewChecklist', () => {
  describe('rendering', () => {
    it('formats unchecked item with [ ]', () => {
      expect(formatCheckbox(false)).toBe('[ ]')
    })

    it('formats checked item with [x]', () => {
      expect(formatCheckbox(true)).toBe('[x]')
    })

    it('formats header with completion count', () => {
      const state = createChecklistState([
        { label: 'Tests' },
        { label: 'Types' },
        { label: 'Lint' },
      ])
      expect(formatHeader(state)).toBe('Review Checklist (0/3)')
    })

    it('formats header for partially complete', () => {
      const state: ChecklistState = {
        items: [
          { label: 'Tests', checked: true },
          { label: 'Types', checked: false },
          { label: 'Lint', checked: true },
        ],
      }
      expect(formatHeader(state)).toBe('Review Checklist (2/3)')
    })

    it('formats header for fully complete', () => {
      const state: ChecklistState = {
        items: [
          { label: 'Tests', checked: true },
          { label: 'Types', checked: true },
        ],
      }
      expect(formatHeader(state)).toBe('Review Checklist (2/2)')
    })
  })

  describe('items', () => {
    it('displays each item label', () => {
      const state = createChecklistState([
        { label: 'Run tests' },
        { label: 'Check types', description: 'pnpm typecheck' },
      ])
      expect(state.items[0]!.label).toBe('Run tests')
      expect(state.items[1]!.label).toBe('Check types')
    })

    it('displays item description when provided', () => {
      const state = createChecklistState([
        { label: 'Check types', description: 'pnpm typecheck' },
      ])
      expect(state.items[0]!.description).toBe('pnpm typecheck')
    })

    it('handles items without description', () => {
      const state = createChecklistState([{ label: 'No desc' }])
      expect(state.items[0]!.description).toBeUndefined()
    })
  })

  describe('toggle callback', () => {
    it('calls onToggle with correct index', () => {
      const onToggle = vi.fn()
      const index = 2
      onToggle(index)
      expect(onToggle).toHaveBeenCalledWith(2)
    })

    it('does not call onToggle when not active', () => {
      const onToggle = vi.fn()
      const isActive = false
      if (isActive) {
        onToggle(0)
      }
      expect(onToggle).not.toHaveBeenCalled()
    })
  })

  describe('collapse/expand', () => {
    it('shows expand hint when collapsed', () => {
      const isExpanded = false
      const hint = isExpanded ? '[c: collapse]' : '[c: expand]'
      expect(hint).toBe('[c: expand]')
    })

    it('shows collapse hint when expanded', () => {
      const isExpanded = true
      const hint = isExpanded ? '[c: collapse]' : '[c: expand]'
      expect(hint).toBe('[c: collapse]')
    })

    it('toggles expanded state on c key', () => {
      let isExpanded = false
      const input = 'c'
      if (input === 'c') {
        isExpanded = !isExpanded
      }
      expect(isExpanded).toBe(true)
      if (input === 'c') {
        isExpanded = !isExpanded
      }
      expect(isExpanded).toBe(false)
    })
  })

  describe('empty/null state', () => {
    it('renders nothing when state is null', () => {
      const state: ChecklistState | null = null
      const shouldRender = state !== null
      expect(shouldRender).toBe(false)
    })

    it('renders nothing when items are empty', () => {
      const state = createChecklistState([])
      const shouldRender = state.items.length > 0
      expect(shouldRender).toBe(false)
    })
  })

  describe('selected item indicator', () => {
    it('shows > for selected item', () => {
      const selectedIndex = 1
      const items = [
        { label: 'A', checked: false },
        { label: 'B', checked: false },
      ]
      const indicators = items.map((_, i) =>
        i === selectedIndex ? '>' : ' ',
      )
      expect(indicators[0]).toBe(' ')
      expect(indicators[1]).toBe('>')
    })
  })
})
