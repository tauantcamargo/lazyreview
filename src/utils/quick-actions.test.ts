import { describe, it, expect } from 'vitest'
import {
  getQuickActions,
  type QuickActionContext,
  type QuickAction,
} from './quick-actions'

describe('getQuickActions', () => {
  // ---------------------------------------------------------------------------
  // PR List screen actions
  // ---------------------------------------------------------------------------

  describe('pr-list screen with open PR', () => {
    const context: QuickActionContext = {
      screen: 'pr-list',
      itemType: 'pull-request',
      itemState: 'open',
    }

    it('returns actions for open PRs on the list screen', () => {
      const actions = getQuickActions(context)
      expect(actions.length).toBeGreaterThanOrEqual(5)
      expect(actions.length).toBeLessThanOrEqual(8)
    })

    it('includes open-in-browser action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Open in browser')
    })

    it('includes copy-url action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Copy URL')
    })

    it('includes filter action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Filter PRs')
    })

    it('includes sort action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Sort PRs')
    })

    it('includes toggle-state action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Toggle state')
    })

    it('includes keybinding for each action', () => {
      const actions = getQuickActions(context)
      for (const action of actions) {
        expect(action.keybinding.length).toBeGreaterThan(0)
      }
    })

    it('includes action identifier for each action', () => {
      const actions = getQuickActions(context)
      for (const action of actions) {
        expect(action.action.length).toBeGreaterThan(0)
      }
    })
  })

  describe('pr-list screen with closed PR', () => {
    const context: QuickActionContext = {
      screen: 'pr-list',
      itemType: 'pull-request',
      itemState: 'closed',
    }

    it('returns actions for closed PRs', () => {
      const actions = getQuickActions(context)
      expect(actions.length).toBeGreaterThanOrEqual(5)
    })

    it('includes toggle-unread for closed PRs', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Toggle unread')
    })
  })

  // ---------------------------------------------------------------------------
  // PR Detail screen actions
  // ---------------------------------------------------------------------------

  describe('pr-detail screen with open PR', () => {
    const context: QuickActionContext = {
      screen: 'pr-detail',
      itemType: 'pull-request',
      itemState: 'open',
    }

    it('returns 5-8 actions for open PR detail', () => {
      const actions = getQuickActions(context)
      expect(actions.length).toBeGreaterThanOrEqual(5)
      expect(actions.length).toBeLessThanOrEqual(8)
    })

    it('includes submit-review action for open PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Submit review')
    })

    it('includes merge action for open PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Merge PR')
    })

    it('includes open-in-browser on detail screen', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Open in browser')
    })

    it('includes edit-title action for open PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Edit title')
    })
  })

  describe('pr-detail screen with merged PR', () => {
    const context: QuickActionContext = {
      screen: 'pr-detail',
      itemType: 'pull-request',
      itemState: 'merged',
    }

    it('does NOT include merge action for merged PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).not.toContain('Merge PR')
    })

    it('does NOT include submit-review for merged PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).not.toContain('Submit review')
    })

    it('still includes open-in-browser for merged PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Open in browser')
    })

    it('still includes copy URL for merged PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Copy URL')
    })
  })

  describe('pr-detail screen with draft PR', () => {
    const context: QuickActionContext = {
      screen: 'pr-detail',
      itemType: 'pull-request',
      itemState: 'draft',
    }

    it('includes toggle-draft action for draft PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Mark ready for review')
    })

    it('does NOT include merge action for draft PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).not.toContain('Merge PR')
    })
  })

  describe('pr-detail screen with closed PR', () => {
    const context: QuickActionContext = {
      screen: 'pr-detail',
      itemType: 'pull-request',
      itemState: 'closed',
    }

    it('does NOT include merge for closed PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).not.toContain('Merge PR')
    })

    it('does NOT include submit-review for closed PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).not.toContain('Submit review')
    })

    it('includes open-in-browser for closed PR', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Open in browser')
    })
  })

  // ---------------------------------------------------------------------------
  // Files tab actions
  // ---------------------------------------------------------------------------

  describe('files-tab screen', () => {
    const context: QuickActionContext = {
      screen: 'files-tab',
      itemType: 'file',
      itemState: 'open',
    }

    it('returns 5-8 actions for files tab', () => {
      const actions = getQuickActions(context)
      expect(actions.length).toBeGreaterThanOrEqual(5)
      expect(actions.length).toBeLessThanOrEqual(8)
    })

    it('includes inline-comment action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Add inline comment')
    })

    it('includes toggle-side-by-side action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Toggle side-by-side')
    })

    it('includes search-in-diff action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Search in diff')
    })

    it('includes fuzzy-file-picker action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Go to file')
    })

    it('includes visual-select action', () => {
      const actions = getQuickActions(context)
      const labels = actions.map((a) => a.label)
      expect(labels).toContain('Visual select')
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('returns at least 5 actions for any valid context', () => {
      const contexts: readonly QuickActionContext[] = [
        { screen: 'pr-list', itemType: 'pull-request', itemState: 'open' },
        { screen: 'pr-detail', itemType: 'pull-request', itemState: 'open' },
        { screen: 'files-tab', itemType: 'file', itemState: 'open' },
      ]

      for (const ctx of contexts) {
        const actions = getQuickActions(ctx)
        expect(actions.length).toBeGreaterThanOrEqual(5)
      }
    })

    it('returns no more than 8 actions for any context', () => {
      const contexts: readonly QuickActionContext[] = [
        { screen: 'pr-list', itemType: 'pull-request', itemState: 'open' },
        { screen: 'pr-detail', itemType: 'pull-request', itemState: 'open' },
        { screen: 'pr-detail', itemType: 'pull-request', itemState: 'merged' },
        { screen: 'pr-detail', itemType: 'pull-request', itemState: 'closed' },
        { screen: 'pr-detail', itemType: 'pull-request', itemState: 'draft' },
        { screen: 'files-tab', itemType: 'file', itemState: 'open' },
      ]

      for (const ctx of contexts) {
        const actions = getQuickActions(ctx)
        expect(actions.length).toBeLessThanOrEqual(8)
      }
    })

    it('all actions have unique action identifiers within a context', () => {
      const context: QuickActionContext = {
        screen: 'pr-detail',
        itemType: 'pull-request',
        itemState: 'open',
      }
      const actions = getQuickActions(context)
      const actionIds = actions.map((a) => a.action)
      const uniqueIds = new Set(actionIds)
      expect(uniqueIds.size).toBe(actionIds.length)
    })

    it('all actions have non-empty labels', () => {
      const context: QuickActionContext = {
        screen: 'pr-list',
        itemType: 'pull-request',
        itemState: 'open',
      }
      const actions = getQuickActions(context)
      for (const action of actions) {
        expect(action.label.trim().length).toBeGreaterThan(0)
      }
    })

    it('actions are immutable (frozen-like behavior)', () => {
      const context: QuickActionContext = {
        screen: 'pr-list',
        itemType: 'pull-request',
        itemState: 'open',
      }
      const actions1 = getQuickActions(context)
      const actions2 = getQuickActions(context)
      // Should return same content for same input
      expect(actions1).toEqual(actions2)
      // But different array references (no mutation risk)
      expect(actions1).not.toBe(actions2)
    })
  })
})
