import { describe, it, expect } from 'vitest'
import {
  buildCommandPaletteActions,
  type CommandPaletteAction,
} from './command-palette-actions'

describe('buildCommandPaletteActions', () => {
  it('should always include global actions', () => {
    const actions = buildCommandPaletteActions('pr-list')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).toContain('toggleSidebar')
    expect(actionNames).toContain('toggleHelp')
    expect(actionNames).toContain('refresh')
  })

  it('should include prList actions for pr-list screen', () => {
    const actions = buildCommandPaletteActions('pr-list')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).toContain('filterPRs')
    expect(actionNames).toContain('sortPRs')
    expect(actionNames).toContain('nextPage')
    expect(actionNames).toContain('openInBrowser')
  })

  it('should include prDetail actions for pr-detail screens', () => {
    const actions = buildCommandPaletteActions('pr-detail-description')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).toContain('submitReview')
    expect(actionNames).toContain('mergePR')
    expect(actionNames).toContain('closePR')
  })

  it('should include conversations actions for conversations screen', () => {
    const actions = buildCommandPaletteActions('pr-detail-conversations')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).toContain('newComment')
    expect(actionNames).toContain('reply')
    expect(actionNames).toContain('resolveThread')
  })

  it('should include filesTab actions for files screen', () => {
    const actions = buildCommandPaletteActions('pr-detail-files')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).toContain('toggleSideBySide')
    expect(actionNames).toContain('inlineComment')
    expect(actionNames).toContain('focusTree')
    expect(actionNames).toContain('focusDiff')
  })

  it('should include checksTab actions for checks screen', () => {
    const actions = buildCommandPaletteActions('pr-detail-checks')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).toContain('openInBrowser')
    expect(actionNames).toContain('copyUrl')
  })

  it('should include commitsTab actions for commits screen', () => {
    const actions = buildCommandPaletteActions('pr-detail-commits')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).toContain('copyCommitSha')
  })

  it('should have description for every action', () => {
    const actions = buildCommandPaletteActions('pr-list')
    for (const action of actions) {
      expect(action.description).toBeTruthy()
      expect(action.description.length).toBeGreaterThan(0)
    }
  })

  it('should have keybinding display for every action', () => {
    const actions = buildCommandPaletteActions('pr-list')
    for (const action of actions) {
      expect(action.keyDisplay).toBeTruthy()
      expect(action.keyDisplay.length).toBeGreaterThan(0)
    }
  })

  it('should not have duplicate actions', () => {
    const actions = buildCommandPaletteActions('pr-detail-files')
    const actionNames = actions.map((a) => a.action)
    const unique = new Set(actionNames)
    expect(unique.size).toBe(actionNames.length)
  })

  it('should not include navigation actions (moveUp, moveDown, select, back)', () => {
    const actions = buildCommandPaletteActions('pr-list')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).not.toContain('moveUp')
    expect(actionNames).not.toContain('moveDown')
    expect(actionNames).not.toContain('select')
    expect(actionNames).not.toContain('back')
    expect(actionNames).not.toContain('quit')
  })

  it('should not include input-only actions', () => {
    const actions = buildCommandPaletteActions('pr-list')
    const actionNames = actions.map((a) => a.action)
    expect(actionNames).not.toContain('submit')
    expect(actionNames).not.toContain('newLine')
    expect(actionNames).not.toContain('indent')
  })

  it('should apply keybinding overrides', () => {
    const overrides = { prList: { filterPRs: 'f' } }
    const actions = buildCommandPaletteActions('pr-list', overrides)
    const filterAction = actions.find((a) => a.action === 'filterPRs')
    expect(filterAction).toBeDefined()
    expect(filterAction!.keyDisplay).toBe('f')
  })

  it('should have a context label for each action', () => {
    const actions = buildCommandPaletteActions('pr-detail-files')
    for (const action of actions) {
      expect(action.contextLabel).toBeTruthy()
    }
  })

  it('should handle settings screen with only global actions', () => {
    const actions = buildCommandPaletteActions('settings')
    expect(actions.length).toBeGreaterThan(0)
    // Settings only has global context
    const contexts = new Set(actions.map((a) => a.contextLabel))
    expect(contexts.has('Global')).toBe(true)
  })
})
