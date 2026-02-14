import { describe, it, expect } from 'vitest'
import {
  computeWordDiff,
  tokenize,
  type WordDiffSegment,
} from './word-diff'

describe('tokenize', () => {
  it('splits on whitespace boundaries', () => {
    expect(tokenize('hello world')).toEqual(['hello', ' ', 'world'])
  })

  it('splits on punctuation boundaries', () => {
    expect(tokenize('foo.bar(baz)')).toEqual([
      'foo',
      '.',
      'bar',
      '(',
      'baz',
      ')',
    ])
  })

  it('preserves leading whitespace', () => {
    expect(tokenize('  const x = 1')).toEqual([
      '  ',
      'const',
      ' ',
      'x',
      ' ',
      '=',
      ' ',
      '1',
    ])
  })

  it('handles empty string', () => {
    expect(tokenize('')).toEqual([])
  })

  it('handles whitespace-only string', () => {
    expect(tokenize('   ')).toEqual(['   '])
  })

  it('handles single word', () => {
    expect(tokenize('hello')).toEqual(['hello'])
  })

  it('handles tabs and mixed whitespace', () => {
    expect(tokenize('\t  foo')).toEqual(['\t  ', 'foo'])
  })

  it('handles consecutive punctuation', () => {
    expect(tokenize('a=>b')).toEqual(['a', '=', '>', 'b'])
  })

  it('handles string with special characters', () => {
    expect(tokenize('if (x !== null)')).toEqual([
      'if',
      ' ',
      '(',
      'x',
      ' ',
      '!',
      '=',
      '=',
      ' ',
      'null',
      ')',
    ])
  })
})

describe('computeWordDiff', () => {
  it('returns all equal segments for identical lines', () => {
    const result = computeWordDiff('const x = 1', 'const x = 1')
    expect(result.oldSegments.every((s) => s.type === 'equal')).toBe(true)
    expect(result.newSegments.every((s) => s.type === 'equal')).toBe(true)
    expect(joinSegments(result.oldSegments)).toBe('const x = 1')
    expect(joinSegments(result.newSegments)).toBe('const x = 1')
  })

  it('highlights a single changed word', () => {
    const result = computeWordDiff('const x = 1', 'const x = 2')
    // The "1" and "2" should be changed
    expectContainsChanged(result.oldSegments, '1')
    expectContainsChanged(result.newSegments, '2')
    // "const x = " should be equal (merged)
    expectContainsEqual(result.oldSegments, 'const')
    expectContainsEqual(result.newSegments, 'const')
  })

  it('highlights multiple changed words', () => {
    const result = computeWordDiff(
      'const foo = bar',
      'let baz = qux',
    )
    expectContainsChanged(result.oldSegments, 'const')
    expectContainsChanged(result.oldSegments, 'foo')
    expectContainsChanged(result.oldSegments, 'bar')
    expectContainsChanged(result.newSegments, 'let')
    expectContainsChanged(result.newSegments, 'baz')
    expectContainsChanged(result.newSegments, 'qux')
    // " = " should appear as equal
    expectContainsEqual(result.oldSegments, '=')
  })

  it('handles completely different lines', () => {
    const result = computeWordDiff('hello', 'world')
    expect(result.oldSegments).toEqual([{ text: 'hello', type: 'changed' }])
    expect(result.newSegments).toEqual([{ text: 'world', type: 'changed' }])
  })

  it('handles empty old line (pure addition)', () => {
    const result = computeWordDiff('', 'new content')
    expect(result.oldSegments).toEqual([])
    expect(result.newSegments).toEqual([{ text: 'new content', type: 'changed' }])
  })

  it('handles empty new line (pure deletion)', () => {
    const result = computeWordDiff('old content', '')
    expect(result.oldSegments).toEqual([{ text: 'old content', type: 'changed' }])
    expect(result.newSegments).toEqual([])
  })

  it('handles both empty lines', () => {
    const result = computeWordDiff('', '')
    expect(result.oldSegments).toEqual([])
    expect(result.newSegments).toEqual([])
  })

  it('handles indentation change', () => {
    const result = computeWordDiff('  return x', '    return x')
    // The indentation should be changed, the rest equal
    expect(result.oldSegments[0]).toEqual({ text: '  ', type: 'changed' })
    expect(result.newSegments[0]).toEqual({ text: '    ', type: 'changed' })
    expectContainsEqual(result.oldSegments, 'return')
    expectContainsEqual(result.newSegments, 'return')
  })

  it('handles punctuation changes', () => {
    const result = computeWordDiff('foo(x)', 'foo[x]')
    expectContainsChanged(result.oldSegments, '(')
    expectContainsChanged(result.oldSegments, ')')
    expectContainsChanged(result.newSegments, '[')
    expectContainsChanged(result.newSegments, ']')
    expectContainsEqual(result.oldSegments, 'foo')
    expectContainsEqual(result.oldSegments, 'x')
  })

  it('reconstructs original text from segments', () => {
    const pairs = [
      ['const x = foo(bar)', 'let y = baz(qux)'],
      ['  if (a && b) {', '  if (a || b) {'],
      ['import { foo } from "bar"', 'import { baz } from "qux"'],
      ['return null', 'return undefined'],
    ] as const

    for (const [oldLine, newLine] of pairs) {
      const result = computeWordDiff(oldLine, newLine)
      expect(joinSegments(result.oldSegments)).toBe(oldLine)
      expect(joinSegments(result.newSegments)).toBe(newLine)
    }
  })

  it('merges adjacent same-type segments', () => {
    const result = computeWordDiff('abc', 'xyz')
    // Should be a single "changed" segment, not multiple
    expect(result.oldSegments).toHaveLength(1)
    expect(result.newSegments).toHaveLength(1)
  })

  it('handles added tokens at end', () => {
    const result = computeWordDiff('foo(x)', 'foo(x, y)')
    // ", y" should be changed (merged)
    expectContainsChanged(result.newSegments, ',')
    expectContainsChanged(result.newSegments, 'y')
    expectContainsEqual(result.oldSegments, 'foo')
    expectContainsEqual(result.newSegments, 'foo')
  })

  it('handles removed tokens from end', () => {
    const result = computeWordDiff('foo(x, y)', 'foo(x)')
    // ", y" should be changed (merged into one segment on old side)
    expectContainsChanged(result.oldSegments, ',')
    expectContainsChanged(result.oldSegments, 'y')
    expectContainsEqual(result.newSegments, 'foo')
  })

  it('handles long lines efficiently without hanging', () => {
    // A long line with a single change should be fast
    const common = 'const longVariableName = someFunction(argument1, argument2, argument3)'
    const oldLine = `${common} // old comment`
    const newLine = `${common} // new comment`
    const start = performance.now()
    const result = computeWordDiff(oldLine, newLine)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(100) // Should be well under 100ms
    expect(joinSegments(result.oldSegments)).toBe(oldLine)
    expect(joinSegments(result.newSegments)).toBe(newLine)
  })

  it('handles realistic code diff', () => {
    const result = computeWordDiff(
      '  const result = await fetchData(url)',
      '  const response = await fetchData(apiUrl)',
    )
    expectContainsChanged(result.oldSegments, 'result')
    expectContainsChanged(result.newSegments, 'response')
    expectContainsChanged(result.oldSegments, 'url')
    expectContainsChanged(result.newSegments, 'apiUrl')
    // Shared tokens should be equal
    expectContainsEqual(result.oldSegments, 'const')
    expectContainsEqual(result.oldSegments, 'await')
    expectContainsEqual(result.oldSegments, 'fetchData')
  })

  it('all segments have non-empty text', () => {
    const pairs = [
      ['foo bar', 'foo baz'],
      ['const x = 1', 'let y = 2'],
      ['  indent', '    indent'],
    ] as const

    for (const [oldLine, newLine] of pairs) {
      const result = computeWordDiff(oldLine, newLine)
      for (const seg of result.oldSegments) {
        expect(seg.text.length).toBeGreaterThan(0)
      }
      for (const seg of result.newSegments) {
        expect(seg.text.length).toBeGreaterThan(0)
      }
    }
  })

  it('no adjacent segments have the same type', () => {
    const pairs = [
      ['foo bar', 'foo baz'],
      ['const x = 1', 'let y = 2'],
      ['a.b(c)', 'a.d(e)'],
    ] as const

    for (const [oldLine, newLine] of pairs) {
      const result = computeWordDiff(oldLine, newLine)
      assertNoAdjacentSameType(result.oldSegments)
      assertNoAdjacentSameType(result.newSegments)
    }
  })
})

/**
 * Helper to join segments back into a single string for verification.
 */
function joinSegments(segments: readonly WordDiffSegment[]): string {
  return segments.map((s) => s.text).join('')
}

/**
 * Assert that the segments contain a "changed" segment whose text includes the given substring.
 */
function expectContainsChanged(
  segments: readonly WordDiffSegment[],
  substring: string,
): void {
  const changedText = segments
    .filter((s) => s.type === 'changed')
    .map((s) => s.text)
    .join('')
  expect(changedText).toContain(substring)
}

/**
 * Assert that the segments contain an "equal" segment whose text includes the given substring.
 */
function expectContainsEqual(
  segments: readonly WordDiffSegment[],
  substring: string,
): void {
  const equalText = segments
    .filter((s) => s.type === 'equal')
    .map((s) => s.text)
    .join('')
  expect(equalText).toContain(substring)
}

/**
 * Assert that no two adjacent segments have the same type.
 */
function assertNoAdjacentSameType(segments: readonly WordDiffSegment[]): void {
  for (let i = 1; i < segments.length; i++) {
    expect(segments[i].type).not.toBe(segments[i - 1].type)
  }
}
