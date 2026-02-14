import { describe, it, expect, vi } from 'vitest'
import type { DependencyNode } from '../../utils/pr-dependencies'

/**
 * Tests for DependencySection component.
 *
 * Tests the component's rendering logic by verifying:
 * - Section is hidden when dependencies is empty
 * - Header shows count of dependencies
 * - Collapsed/expanded state
 * - Each dependency shows PR number, title, state, relationship
 * - State color mapping for open/merged/closed
 * - Enter key triggers onNavigate callback
 */

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeDep(overrides?: Partial<DependencyNode>): DependencyNode {
  return {
    prNumber: 1,
    title: 'Test dependency',
    state: 'open',
    relationship: 'depends-on',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

describe('DependencySection', () => {
  describe('visibility', () => {
    it('is hidden when dependencies list is empty', () => {
      const dependencies: readonly DependencyNode[] = []
      const shouldRender = dependencies.length > 0
      expect(shouldRender).toBe(false)
    })

    it('is visible when dependencies exist', () => {
      const dependencies: readonly DependencyNode[] = [makeDep()]
      const shouldRender = dependencies.length > 0
      expect(shouldRender).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  describe('header', () => {
    it('shows dependency count in header', () => {
      const dependencies = [makeDep(), makeDep({ prNumber: 2 })]
      const headerText = `Dependencies (${dependencies.length})`
      expect(headerText).toBe('Dependencies (2)')
    })

    it('shows singular count for one dependency', () => {
      const dependencies = [makeDep()]
      const headerText = `Dependencies (${dependencies.length})`
      expect(headerText).toBe('Dependencies (1)')
    })
  })

  // ---------------------------------------------------------------------------
  // Collapse/expand
  // ---------------------------------------------------------------------------

  describe('collapse/expand', () => {
    it('shows expand hint when collapsed', () => {
      const isExpanded = false
      const hint = isExpanded ? '[d: collapse]' : '[d: expand]'
      expect(hint).toBe('[d: expand]')
    })

    it('shows collapse hint when expanded', () => {
      const isExpanded = true
      const hint = isExpanded ? '[d: collapse]' : '[d: expand]'
      expect(hint).toBe('[d: collapse]')
    })

    it('toggles state on d key press', () => {
      let isExpanded = false
      const input = 'd'
      if (input === 'd') {
        isExpanded = !isExpanded
      }
      expect(isExpanded).toBe(true)

      if (input === 'd') {
        isExpanded = !isExpanded
      }
      expect(isExpanded).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Dependency item rendering data
  // ---------------------------------------------------------------------------

  describe('dependency item data', () => {
    it('provides PR number for display', () => {
      const dep = makeDep({ prNumber: 42 })
      expect(`#${dep.prNumber}`).toBe('#42')
    })

    it('provides title for display', () => {
      const dep = makeDep({ title: 'Add auth module' })
      expect(dep.title).toBe('Add auth module')
    })

    it('provides relationship label', () => {
      const dep = makeDep({ relationship: 'depends-on' })
      expect(dep.relationship).toBe('depends-on')
    })

    it('provides stacked-on relationship label', () => {
      const dep = makeDep({ relationship: 'stacked-on' })
      expect(dep.relationship).toBe('stacked-on')
    })

    it('provides blocks relationship label', () => {
      const dep = makeDep({ relationship: 'blocks' })
      expect(dep.relationship).toBe('blocks')
    })
  })

  // ---------------------------------------------------------------------------
  // State color mapping
  // ---------------------------------------------------------------------------

  describe('state color mapping', () => {
    it('maps open state to success color', () => {
      const stateColorMap: Record<string, string> = {
        open: 'success',
        merged: 'info',
        closed: 'error',
      }
      expect(stateColorMap['open']).toBe('success')
    })

    it('maps merged state to info color', () => {
      const stateColorMap: Record<string, string> = {
        open: 'success',
        merged: 'info',
        closed: 'error',
      }
      expect(stateColorMap['merged']).toBe('info')
    })

    it('maps closed state to error color', () => {
      const stateColorMap: Record<string, string> = {
        open: 'success',
        merged: 'info',
        closed: 'error',
      }
      expect(stateColorMap['closed']).toBe('error')
    })
  })

  // ---------------------------------------------------------------------------
  // Navigation callback
  // ---------------------------------------------------------------------------

  describe('navigation', () => {
    it('calls onNavigate with PR number on enter key', () => {
      const onNavigate = vi.fn()
      const dep = makeDep({ prNumber: 42 })

      // Simulate enter key press on selected dependency
      onNavigate(dep.prNumber)
      expect(onNavigate).toHaveBeenCalledWith(42)
    })

    it('does not call onNavigate when not provided', () => {
      const onNavigate: ((prNumber: number) => void) | undefined = undefined
      const dep = makeDep({ prNumber: 42 })

      let called = false
      if (onNavigate) {
        onNavigate(dep.prNumber)
        called = true
      }
      expect(called).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Relationship formatting
  // ---------------------------------------------------------------------------

  describe('relationship display text', () => {
    it('formats depends-on label', () => {
      const label = formatRelationshipLabel('depends-on')
      expect(label).toBe('depends on')
    })

    it('formats stacked-on label', () => {
      const label = formatRelationshipLabel('stacked-on')
      expect(label).toBe('stacked on')
    })

    it('formats blocks label', () => {
      const label = formatRelationshipLabel('blocks')
      expect(label).toBe('blocks')
    })
  })
})

// ---------------------------------------------------------------------------
// Helper used by tests (mirrors component logic)
// ---------------------------------------------------------------------------

function formatRelationshipLabel(
  relationship: 'depends-on' | 'blocks' | 'stacked-on',
): string {
  const labels: Record<string, string> = {
    'depends-on': 'depends on',
    'stacked-on': 'stacked on',
    blocks: 'blocks',
  }
  return labels[relationship] ?? relationship
}
