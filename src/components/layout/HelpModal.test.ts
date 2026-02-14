import { describe, it, expect } from 'vitest'
import { buildShortcutGroups } from './HelpModal'

describe('buildShortcutGroups', () => {
  it('builds groups with default bindings', () => {
    const groups = buildShortcutGroups(undefined)
    expect(groups.length).toBeGreaterThan(0)
  })

  it('global group has expected entries', () => {
    const groups = buildShortcutGroups(undefined)
    const global = groups.find((g) => g.title === 'Global')
    expect(global).toBeDefined()
    expect(global!.items.length).toBeGreaterThan(0)

    const moveDown = global!.items.find((s) => s.description === 'Move down')
    expect(moveDown).toBeDefined()
    expect(moveDown!.key).toBe('j / \u2193')

    const toggleHelp = global!.items.find((s) => s.description === 'Toggle this help')
    expect(toggleHelp).toBeDefined()
    expect(toggleHelp!.key).toBe('?')
  })

  it('PR List group includes static entries', () => {
    const groups = buildShortcutGroups(undefined)
    const prList = groups.find((g) => g.title === 'PR List')
    expect(prList).toBeDefined()

    const refresh = prList!.items.find((s) => s.description === 'Refresh')
    expect(refresh).toBeDefined()
    expect(refresh!.key).toBe('R')
  })

  it('PR Detail group includes tab switching static entry', () => {
    const groups = buildShortcutGroups(undefined)
    const prDetail = groups.find((g) => g.title === 'PR Detail')
    expect(prDetail).toBeDefined()

    const tabs = prDetail!.items.find((s) =>
      s.description.includes('Switch tabs'),
    )
    expect(tabs).toBeDefined()
  })

  it('applies user overrides to display', () => {
    const groups = buildShortcutGroups({
      global: { toggleHelp: 'h' },
    })
    const global = groups.find((g) => g.title === 'Global')
    expect(global).toBeDefined()

    const toggleHelp = global!.items.find((s) => s.description === 'Toggle this help')
    expect(toggleHelp).toBeDefined()
    expect(toggleHelp!.key).toBe('h')
  })

  it('preserves non-overridden entries when overrides are set', () => {
    const groups = buildShortcutGroups({
      global: { toggleHelp: 'h' },
    })
    const global = groups.find((g) => g.title === 'Global')
    expect(global).toBeDefined()

    const moveDown = global!.items.find((s) => s.description === 'Move down')
    expect(moveDown).toBeDefined()
    expect(moveDown!.key).toBe('j / \u2193')
  })

  it('all expected sections are present', () => {
    const groups = buildShortcutGroups(undefined)
    const titles = groups.map((g) => g.title)
    expect(titles).toContain('Global')
    expect(titles).toContain('PR List')
    expect(titles).toContain('PR Detail')
    expect(titles).toContain('Conversations Tab')
    expect(titles).toContain('Files Tab')
    expect(titles).toContain('Checks Tab')
    expect(titles).toContain('Commits Tab')
    expect(titles).toContain('Comment / Review Input')
  })

  it('Files Tab includes static search entries', () => {
    const groups = buildShortcutGroups(undefined)
    const filesTab = groups.find((g) => g.title === 'Files Tab')
    expect(filesTab).toBeDefined()

    const searchMatch = filesTab!.items.find((s) =>
      s.description.includes('search match'),
    )
    expect(searchMatch).toBeDefined()
  })

  it('input group has submit with Ctrl+s', () => {
    const groups = buildShortcutGroups(undefined)
    const input = groups.find((g) => g.title === 'Comment / Review Input')
    expect(input).toBeDefined()

    const submit = input!.items.find((s) => s.description === 'Submit')
    expect(submit).toBeDefined()
    expect(submit!.key).toBe('Ctrl+s')
  })
})
