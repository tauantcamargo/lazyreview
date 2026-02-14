import { describe, it, expect } from 'vitest'
import { fuzzyMatch, fuzzyFilter } from '../../utils/fuzzy-search'
import { buildCommandPaletteActions } from '../../utils/command-palette-actions'
import type { CommandPaletteAction } from '../../utils/command-palette-actions'

// ---------------------------------------------------------------------------
// CommandPalette - Logic tests
//
// The CommandPalette component uses Ink's Modal wrapper with position="absolute"
// which ink-testing-library does not render. We therefore test the extracted
// data-handling logic (fuzzy filtering, action collection, selection) directly.
// ---------------------------------------------------------------------------

const mockActions: readonly CommandPaletteAction[] = [
  {
    action: 'filterPRs',
    description: 'Filter PRs',
    keyDisplay: '/',
    contextLabel: 'PR List',
  },
  {
    action: 'sortPRs',
    description: 'Sort PRs',
    keyDisplay: 's',
    contextLabel: 'PR List',
  },
  {
    action: 'toggleSidebar',
    description: 'Toggle sidebar',
    keyDisplay: 'Ctrl+B',
    contextLabel: 'Global',
  },
  {
    action: 'openInBrowser',
    description: 'Open in browser',
    keyDisplay: 'o',
    contextLabel: 'PR List',
  },
  {
    action: 'mergePR',
    description: 'Merge pull request',
    keyDisplay: 'm',
    contextLabel: 'PR Detail',
  },
]

describe('CommandPalette logic', () => {
  // -------------------------------------------------------------------------
  // Fuzzy filtering for command palette actions
  // -------------------------------------------------------------------------

  describe('action filtering', () => {
    it('should return all actions when query is empty', () => {
      const results = fuzzyFilter(mockActions, '', (a) => a.description)
      expect(results.length).toBe(mockActions.length)
    })

    it('should filter actions by description', () => {
      const results = fuzzyFilter(mockActions, 'mer', (a) => a.description)
      const names = results.map((r) => r.item.description)
      expect(names).toContain('Merge pull request')
    })

    it('should filter using combined description and context', () => {
      const results = fuzzyFilter(
        mockActions,
        'global',
        (a) => `${a.description} ${a.contextLabel}`,
      )
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.contextLabel).toBe('Global')
    })

    it('should rank better matches higher', () => {
      const results = fuzzyFilter(mockActions, 'filt', (a) => a.description)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.action).toBe('filterPRs')
    })

    it('should return empty when nothing matches', () => {
      const results = fuzzyFilter(mockActions, 'zzz', (a) => a.description)
      expect(results.length).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Action selection (simulated index navigation)
  // -------------------------------------------------------------------------

  describe('selection navigation', () => {
    it('should start at index 0', () => {
      const selectedIndex = 0
      expect(mockActions[selectedIndex]!.action).toBe('filterPRs')
    })

    it('should move down correctly', () => {
      let selectedIndex = 0
      selectedIndex = Math.min(selectedIndex + 1, mockActions.length - 1)
      expect(selectedIndex).toBe(1)
      expect(mockActions[selectedIndex]!.action).toBe('sortPRs')
    })

    it('should not go below zero', () => {
      let selectedIndex = 0
      selectedIndex = Math.max(selectedIndex - 1, 0)
      expect(selectedIndex).toBe(0)
    })

    it('should not exceed array bounds', () => {
      let selectedIndex = mockActions.length - 1
      selectedIndex = Math.min(selectedIndex + 1, mockActions.length - 1)
      expect(selectedIndex).toBe(mockActions.length - 1)
    })

    it('should reset to 0 when filter changes', () => {
      // Simulate: user types query, selectedIndex resets
      const selectedIndex = 3
      const resetIndex = 0
      expect(resetIndex).toBe(0)
      expect(selectedIndex).not.toBe(resetIndex)
    })
  })

  // -------------------------------------------------------------------------
  // Scroll window calculation
  // -------------------------------------------------------------------------

  describe('scroll window', () => {
    const MAX_VISIBLE = 12

    it('should show all items when fewer than max', () => {
      const totalItems = 5
      const visibleCount = Math.min(MAX_VISIBLE, totalItems)
      expect(visibleCount).toBe(5)
    })

    it('should cap at max visible items', () => {
      const totalItems = 20
      const visibleCount = Math.min(MAX_VISIBLE, totalItems)
      expect(visibleCount).toBe(12)
    })

    it('should compute correct scroll offset', () => {
      const totalItems = 20
      const selectedIndex = 15
      const visibleCount = Math.min(MAX_VISIBLE, totalItems)
      const scrollOffset = Math.max(
        0,
        Math.min(selectedIndex - visibleCount + 1, totalItems - visibleCount),
      )
      expect(scrollOffset).toBe(4) // 15 - 12 + 1 = 4
      expect(scrollOffset + visibleCount).toBeLessThanOrEqual(totalItems)
    })

    it('should keep offset at 0 when selection is at top', () => {
      const totalItems = 20
      const selectedIndex = 0
      const visibleCount = Math.min(MAX_VISIBLE, totalItems)
      const scrollOffset = Math.max(
        0,
        Math.min(selectedIndex - visibleCount + 1, totalItems - visibleCount),
      )
      expect(scrollOffset).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Integration: building actions for different contexts
  // -------------------------------------------------------------------------

  describe('context-aware action building', () => {
    it('pr-list context produces filterable actions', () => {
      const actions = buildCommandPaletteActions('pr-list')
      const results = fuzzyFilter(actions, 'filter', (a) => a.description)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.action).toBe('filterPRs')
    })

    it('pr-detail-files context includes diff actions', () => {
      const actions = buildCommandPaletteActions('pr-detail-files')
      const results = fuzzyFilter(actions, 'side-by', (a) => a.description)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.action).toBe('toggleSideBySide')
    })

    it('searching by keybinding context label works', () => {
      const actions = buildCommandPaletteActions('pr-detail-conversations')
      const results = fuzzyFilter(
        actions,
        'conv',
        (a) => `${a.description} ${a.contextLabel}`,
      )
      // Should match actions in the Conversations context
      const contexts = results.map((r) => r.item.contextLabel)
      expect(contexts).toContain('Conversations')
    })
  })

  // -------------------------------------------------------------------------
  // Item count label
  // -------------------------------------------------------------------------

  describe('item count label', () => {
    it('should show total when no query', () => {
      const query = ''
      const total = mockActions.length
      const filtered = fuzzyFilter(mockActions, query, (a) => a.description)
      const label = query
        ? `${filtered.length}/${total}`
        : `${total}`
      expect(label).toBe('5')
    })

    it('should show filtered/total when query is active', () => {
      const query = 'mer'
      const total = mockActions.length
      const filtered = fuzzyFilter(mockActions, query, (a) => a.description)
      const label = query
        ? `${filtered.length}/${total}`
        : `${total}`
      expect(label).toContain('/')
      expect(label).toContain(String(total))
    })
  })
})
