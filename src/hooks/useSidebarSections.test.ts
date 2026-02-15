import { describe, it, expect } from 'vitest'
import {
  getItemIndex,
  SIDEBAR_SECTIONS,
} from './useSidebarSections'
import type { NavigableEntry } from './useSidebarSections'

describe('SIDEBAR_SECTIONS', () => {
  it('defines Reviews section with items 0-4', () => {
    const reviews = SIDEBAR_SECTIONS[0]
    expect(reviews?.name).toBe('Reviews')
    expect(reviews?.itemIndices).toEqual([0, 1, 2, 3, 4])
  })

  it('defines Team section with item 5', () => {
    const team = SIDEBAR_SECTIONS[1]
    expect(team?.name).toBe('Team')
    expect(team?.itemIndices).toEqual([5])
  })

  it('defines App section with item 6', () => {
    const app = SIDEBAR_SECTIONS[2]
    expect(app?.name).toBe('App')
    expect(app?.itemIndices).toEqual([6])
  })
})

describe('getItemIndex', () => {
  it('returns itemIndex for item entries', () => {
    const entry: NavigableEntry = { type: 'item', itemIndex: 2 }
    expect(getItemIndex(entry)).toBe(2)
  })

  it('returns null for section entries', () => {
    const entry: NavigableEntry = { type: 'section', sectionName: 'Reviews' }
    expect(getItemIndex(entry)).toBeNull()
  })
})

describe('NavigableEntry type', () => {
  it('creates section entry', () => {
    const entry: NavigableEntry = { type: 'section', sectionName: 'App' }
    expect(entry.type).toBe('section')
    expect(entry.sectionName).toBe('App')
  })

  it('creates item entry', () => {
    const entry: NavigableEntry = { type: 'item', itemIndex: 3 }
    expect(entry.type).toBe('item')
    expect(entry.itemIndex).toBe(3)
  })

  it('builds full expanded navigable list', () => {
    // Simulate what the hook does when no sections collapsed
    const entries: NavigableEntry[] = []
    for (const section of SIDEBAR_SECTIONS) {
      entries.push({ type: 'section', sectionName: section.name })
      for (const idx of section.itemIndices) {
        entries.push({ type: 'item', itemIndex: idx })
      }
    }
    // 3 section headers + 7 items = 10
    expect(entries).toHaveLength(10)
    expect(entries[0]).toEqual({ type: 'section', sectionName: 'Reviews' })
    expect(entries[1]).toEqual({ type: 'item', itemIndex: 0 })
    expect(entries[6]).toEqual({ type: 'section', sectionName: 'Team' })
    expect(entries[7]).toEqual({ type: 'item', itemIndex: 5 })
    expect(entries[8]).toEqual({ type: 'section', sectionName: 'App' })
    expect(entries[9]).toEqual({ type: 'item', itemIndex: 6 })
  })

  it('builds collapsed list for Reviews', () => {
    const collapsed = new Set(['Reviews'])
    const entries: NavigableEntry[] = []
    for (const section of SIDEBAR_SECTIONS) {
      entries.push({ type: 'section', sectionName: section.name })
      if (!collapsed.has(section.name)) {
        for (const idx of section.itemIndices) {
          entries.push({ type: 'item', itemIndex: idx })
        }
      }
    }
    // 3 headers + 1 Team item + 1 App item = 5
    expect(entries).toHaveLength(5)
    expect(entries[0]).toEqual({ type: 'section', sectionName: 'Reviews' })
    expect(entries[1]).toEqual({ type: 'section', sectionName: 'Team' })
    expect(entries[2]).toEqual({ type: 'item', itemIndex: 5 })
    expect(entries[3]).toEqual({ type: 'section', sectionName: 'App' })
    expect(entries[4]).toEqual({ type: 'item', itemIndex: 6 })
  })

  it('builds collapsed list for all sections', () => {
    const collapsed = new Set(['Reviews', 'Team', 'App'])
    const entries: NavigableEntry[] = []
    for (const section of SIDEBAR_SECTIONS) {
      entries.push({ type: 'section', sectionName: section.name })
      if (!collapsed.has(section.name)) {
        for (const idx of section.itemIndices) {
          entries.push({ type: 'item', itemIndex: idx })
        }
      }
    }
    // 3 headers only, all items collapsed
    expect(entries).toHaveLength(3)
  })
})
