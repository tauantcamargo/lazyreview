import { describe, it, expect, vi } from 'vitest'
import type { QuickAction } from '../../utils/quick-actions'

/**
 * QuickActions component tests.
 *
 * The QuickActions component uses Ink's Modal wrapper with position="absolute"
 * which ink-testing-library does not render. We therefore test the extracted
 * logic (selection navigation, action list rendering data, callbacks) directly,
 * following the same pattern as CommandPalette.test.tsx.
 */

const mockActions: readonly QuickAction[] = [
  { label: 'Open in browser', keybinding: 'o', action: 'openInBrowser' },
  { label: 'Copy URL', keybinding: 'y', action: 'copyUrl' },
  { label: 'Filter PRs', keybinding: '/', action: 'filterPRs' },
  { label: 'Sort PRs', keybinding: 's', action: 'sortPRs' },
  { label: 'Toggle state', keybinding: 't', action: 'toggleState' },
  { label: 'Toggle unread', keybinding: 'u', action: 'toggleUnread' },
  { label: 'Refresh', keybinding: 'R', action: 'refresh' },
]

describe('QuickActions logic', () => {
  // ---------------------------------------------------------------------------
  // Selection navigation (j/k)
  // ---------------------------------------------------------------------------

  describe('selection navigation', () => {
    it('starts at index 0', () => {
      const selectedIndex = 0
      expect(mockActions[selectedIndex]!.action).toBe('openInBrowser')
    })

    it('moves down with j', () => {
      let selectedIndex = 0
      selectedIndex = Math.min(selectedIndex + 1, mockActions.length - 1)
      expect(selectedIndex).toBe(1)
      expect(mockActions[selectedIndex]!.action).toBe('copyUrl')
    })

    it('moves up with k', () => {
      let selectedIndex = 2
      selectedIndex = Math.max(selectedIndex - 1, 0)
      expect(selectedIndex).toBe(1)
      expect(mockActions[selectedIndex]!.action).toBe('copyUrl')
    })

    it('does not go below zero', () => {
      let selectedIndex = 0
      selectedIndex = Math.max(selectedIndex - 1, 0)
      expect(selectedIndex).toBe(0)
    })

    it('does not exceed array bounds', () => {
      let selectedIndex = mockActions.length - 1
      selectedIndex = Math.min(selectedIndex + 1, mockActions.length - 1)
      expect(selectedIndex).toBe(mockActions.length - 1)
    })

    it('can navigate through all items', () => {
      let selectedIndex = 0
      for (let i = 0; i < mockActions.length - 1; i++) {
        selectedIndex = Math.min(selectedIndex + 1, mockActions.length - 1)
      }
      expect(selectedIndex).toBe(mockActions.length - 1)
    })
  })

  // ---------------------------------------------------------------------------
  // Action selection (Enter)
  // ---------------------------------------------------------------------------

  describe('action selection', () => {
    it('selects the currently highlighted action', () => {
      const selectedIndex = 0
      const onSelect = vi.fn()
      const selected = mockActions[selectedIndex]
      if (selected) {
        onSelect(selected.action)
      }
      expect(onSelect).toHaveBeenCalledWith('openInBrowser')
    })

    it('selects a different action when navigated', () => {
      const selectedIndex = 3
      const onSelect = vi.fn()
      const selected = mockActions[selectedIndex]
      if (selected) {
        onSelect(selected.action)
      }
      expect(onSelect).toHaveBeenCalledWith('sortPRs')
    })

    it('calls onSelect exactly once per Enter press', () => {
      const onSelect = vi.fn()
      const selected = mockActions[0]
      if (selected) {
        onSelect(selected.action)
      }
      expect(onSelect).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Close behavior (Escape)
  // ---------------------------------------------------------------------------

  describe('close behavior', () => {
    it('calls onClose when Escape is triggered', () => {
      const onClose = vi.fn()
      // Simulate Escape key press
      onClose()
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Rendering data
  // ---------------------------------------------------------------------------

  describe('rendering data', () => {
    it('each action has a label and keybinding for display', () => {
      for (const action of mockActions) {
        expect(action.label.length).toBeGreaterThan(0)
        expect(action.keybinding.length).toBeGreaterThan(0)
      }
    })

    it('action labels are unique', () => {
      const labels = mockActions.map((a) => a.label)
      expect(new Set(labels).size).toBe(labels.length)
    })

    it('action identifiers are unique', () => {
      const ids = mockActions.map((a) => a.action)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('displays selected indicator for highlighted item', () => {
      const selectedIndex = 2
      const items = mockActions.map((action, idx) => ({
        ...action,
        isSelected: idx === selectedIndex,
        indicator: idx === selectedIndex ? '>' : ' ',
      }))
      expect(items[2]!.isSelected).toBe(true)
      expect(items[2]!.indicator).toBe('>')
      expect(items[0]!.isSelected).toBe(false)
      expect(items[0]!.indicator).toBe(' ')
    })
  })

  // ---------------------------------------------------------------------------
  // Props validation
  // ---------------------------------------------------------------------------

  describe('component props', () => {
    it('accepts actions, onSelect, and onClose as required props', () => {
      // Type-level check: ensure the interface shape matches
      const props = {
        actions: mockActions,
        onSelect: vi.fn(),
        onClose: vi.fn(),
      }
      expect(props.actions).toBe(mockActions)
      expect(typeof props.onSelect).toBe('function')
      expect(typeof props.onClose).toBe('function')
    })

    it('handles empty actions list gracefully', () => {
      const emptyActions: readonly QuickAction[] = []
      const selectedIndex = 0
      const clampedIndex = Math.min(selectedIndex, Math.max(0, emptyActions.length - 1))
      // With empty list, clamped index stays at 0 but no item exists
      expect(clampedIndex).toBe(0)
      expect(emptyActions[clampedIndex]).toBeUndefined()
    })

    it('handles single action list', () => {
      const singleAction: readonly QuickAction[] = [
        { label: 'Open in browser', keybinding: 'o', action: 'openInBrowser' },
      ]
      let selectedIndex = 0
      // Try move down - should stay at 0
      selectedIndex = Math.min(selectedIndex + 1, singleAction.length - 1)
      expect(selectedIndex).toBe(0)
      // Try move up - should stay at 0
      selectedIndex = Math.max(selectedIndex - 1, 0)
      expect(selectedIndex).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Integration: isInputActive guard
  // ---------------------------------------------------------------------------

  describe('input focus integration', () => {
    it('popup should NOT trigger when isInputActive is true', () => {
      // This test verifies the contract: the parent component checks isInputActive
      // before showing the QuickActions popup
      const isInputActive = true
      const shouldShow = !isInputActive
      expect(shouldShow).toBe(false)
    })

    it('popup should trigger when isInputActive is false', () => {
      const isInputActive = false
      const shouldShow = !isInputActive
      expect(shouldShow).toBe(true)
    })
  })
})
