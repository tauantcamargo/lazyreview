import { describe, it, expect } from 'vitest'
import { parseDiffPatch } from './diff'

describe('parseDiffPatch', () => {
  it('parses a single hunk with additions and deletions', () => {
    const patch = [
      '@@ -1,3 +1,4 @@',
      ' line one',
      '-old line',
      '+new line',
      '+added line',
      ' line three',
    ].join('\n')

    const hunks = parseDiffPatch(patch)
    expect(hunks).toHaveLength(1)
    expect(hunks[0]!.oldStart).toBe(1)
    expect(hunks[0]!.oldCount).toBe(3)
    expect(hunks[0]!.newStart).toBe(1)
    expect(hunks[0]!.newCount).toBe(4)
    expect(hunks[0]!.lines).toHaveLength(6) // header + 5 content lines
  })

  it('parses multiple hunks', () => {
    const patch = [
      '@@ -1,2 +1,2 @@',
      '-old',
      '+new',
      '@@ -10,2 +10,3 @@',
      ' context',
      '+added',
      ' more context',
    ].join('\n')

    const hunks = parseDiffPatch(patch)
    expect(hunks).toHaveLength(2)
    expect(hunks[0]!.oldStart).toBe(1)
    expect(hunks[1]!.oldStart).toBe(10)
  })

  it('returns empty array for empty input', () => {
    expect(parseDiffPatch('')).toHaveLength(0)
  })

  it('returns empty array for input with no hunk headers', () => {
    expect(parseDiffPatch('just some text\nno hunks here')).toHaveLength(0)
  })

  it('correctly tracks line numbers', () => {
    const patch = [
      '@@ -5,3 +5,3 @@',
      ' context line',
      '-deleted',
      '+added',
      ' trailing',
    ].join('\n')

    const hunks = parseDiffPatch(patch)
    const lines = hunks[0]!.lines

    // header line
    expect(lines[0]!.type).toBe('header')

    // context line at old:5, new:5
    expect(lines[1]!.type).toBe('context')
    expect(lines[1]!.oldLineNumber).toBe(5)
    expect(lines[1]!.newLineNumber).toBe(5)

    // deleted from old:6
    expect(lines[2]!.type).toBe('del')
    expect(lines[2]!.oldLineNumber).toBe(6)

    // added at new:6
    expect(lines[3]!.type).toBe('add')
    expect(lines[3]!.newLineNumber).toBe(6)
  })

  it('handles hunk header with single line count (no comma)', () => {
    const patch = '@@ -1 +1 @@\n-old\n+new'
    const hunks = parseDiffPatch(patch)
    expect(hunks).toHaveLength(1)
    expect(hunks[0]!.oldCount).toBe(1)
    expect(hunks[0]!.newCount).toBe(1)
  })
})
