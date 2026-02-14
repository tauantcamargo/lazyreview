import { describe, it, expect } from 'vitest'
import { fuzzyMatch, fuzzyFilter, type FuzzyResult } from './fuzzy-search'

describe('fuzzyMatch', () => {
  it('should return a match when query is empty', () => {
    const result = fuzzyMatch('', 'Open in browser')
    expect(result).not.toBeNull()
    expect(result!.score).toBe(0)
    expect(result!.indices).toEqual([])
  })

  it('should match when all chars appear in order', () => {
    const result = fuzzyMatch('opb', 'Open in browser')
    expect(result).not.toBeNull()
    expect(result!.indices.length).toBe(3)
  })

  it('should return null when chars do not appear in order', () => {
    const result = fuzzyMatch('zxy', 'Open in browser')
    expect(result).toBeNull()
  })

  it('should be case insensitive', () => {
    const result = fuzzyMatch('OPB', 'Open in browser')
    expect(result).not.toBeNull()
  })

  it('should match exact prefix with high score', () => {
    const resultPrefix = fuzzyMatch('open', 'Open in browser')
    const resultScattered = fuzzyMatch('oibs', 'Open in browser')
    expect(resultPrefix).not.toBeNull()
    expect(resultScattered).not.toBeNull()
    // Prefix match should score higher (lower value = worse in our scoring,
    // higher = better)
    expect(resultPrefix!.score).toBeGreaterThan(resultScattered!.score)
  })

  it('should return correct match indices', () => {
    const result = fuzzyMatch('ob', 'Open in browser')
    expect(result).not.toBeNull()
    // 'o' matches index 0, 'b' matches index 8
    expect(result!.indices).toEqual([0, 8])
  })

  it('should match single character', () => {
    const result = fuzzyMatch('r', 'Refresh')
    expect(result).not.toBeNull()
    expect(result!.indices.length).toBe(1)
  })

  it('should handle query longer than target', () => {
    const result = fuzzyMatch('very long query here', 'short')
    expect(result).toBeNull()
  })

  it('should handle special characters in target', () => {
    const result = fuzzyMatch('ctrl', 'Ctrl+B')
    expect(result).not.toBeNull()
  })

  it('should prefer consecutive character matches', () => {
    const consecutive = fuzzyMatch('mer', 'Merge PR')
    const nonConsecutive = fuzzyMatch('mer', 'Move to error')
    expect(consecutive).not.toBeNull()
    expect(nonConsecutive).not.toBeNull()
    expect(consecutive!.score).toBeGreaterThan(nonConsecutive!.score)
  })

  it('should give bonus for matching at word boundaries', () => {
    const wordStart = fuzzyMatch('pr', 'Merge PR')
    expect(wordStart).not.toBeNull()
    expect(wordStart!.score).toBeGreaterThan(0)
  })
})

describe('fuzzyFilter', () => {
  interface TestItem {
    readonly name: string
    readonly id: number
  }

  const items: readonly TestItem[] = [
    { name: 'Open in browser', id: 1 },
    { name: 'Filter PRs', id: 2 },
    { name: 'Submit review', id: 3 },
    { name: 'Merge PR', id: 4 },
    { name: 'Toggle sidebar', id: 5 },
  ]

  const getText = (item: TestItem): string => item.name

  it('should return all items when query is empty', () => {
    const result = fuzzyFilter(items, '', getText)
    expect(result.length).toBe(items.length)
  })

  it('should filter items matching the query', () => {
    const result = fuzzyFilter(items, 'pr', getText)
    // Should match: "Open in browser" (no), "Filter PRs" (yes), "Submit review" (no),
    // "Merge PR" (yes), "Toggle sidebar" (no)
    const names = result.map((r) => r.item.name)
    expect(names).toContain('Filter PRs')
    expect(names).toContain('Merge PR')
  })

  it('should sort results by score (best match first)', () => {
    const result = fuzzyFilter(items, 'mer', getText)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.item.name).toBe('Merge PR')
  })

  it('should return empty array when nothing matches', () => {
    const result = fuzzyFilter(items, 'zzz', getText)
    expect(result.length).toBe(0)
  })

  it('should include match indices in results', () => {
    const result = fuzzyFilter(items, 'op', getText)
    const match = result.find((r) => r.item.name === 'Open in browser')
    expect(match).toBeDefined()
    expect(match!.indices.length).toBe(2)
  })

  it('should handle empty items array', () => {
    const result = fuzzyFilter([], 'test', getText)
    expect(result).toEqual([])
  })
})
