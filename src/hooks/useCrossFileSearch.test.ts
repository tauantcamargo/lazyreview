import { describe, it, expect } from 'vitest'
import { buildCrossFileMatches, countMatchedFiles, type CrossFileMatch } from './useCrossFileSearch'
import type { FileChange } from '../models/file-change'

function makeFile(filename: string, patch?: string): FileChange {
  return {
    sha: 'abc123',
    filename,
    status: 'modified',
    additions: 1,
    deletions: 1,
    changes: 2,
    patch,
  } as unknown as FileChange
}

describe('buildCrossFileMatches', () => {
  it('returns empty array when query is empty', () => {
    const files = [makeFile('src/foo.ts', '@@ -1,3 +1,3 @@\n context\n+added line\n-removed line')]
    expect(buildCrossFileMatches(files, '')).toEqual([])
  })

  it('returns empty array when no files', () => {
    expect(buildCrossFileMatches([], 'search')).toEqual([])
  })

  it('returns empty array when files have no patch', () => {
    const files = [makeFile('src/foo.ts')]
    expect(buildCrossFileMatches(files, 'search')).toEqual([])
  })

  it('finds matches in a single file', () => {
    const patch = '@@ -1,3 +1,3 @@\n context line\n+added hello world\n-removed old code'
    const files = [makeFile('src/app.ts', patch)]
    const matches = buildCrossFileMatches(files, 'hello')
    expect(matches).toHaveLength(1)
    expect(matches[0]).toEqual({
      filename: 'src/app.ts',
      fileIndex: 0,
      lineIndex: 2,
      lineContent: 'added hello world',
    })
  })

  it('finds matches across multiple files', () => {
    const patch1 = '@@ -1,2 +1,2 @@\n context\n+function hello() {'
    const patch2 = '@@ -1,2 +1,2 @@\n context\n+const hello = 42'
    const files = [
      makeFile('src/a.ts', patch1),
      makeFile('src/b.ts', patch2),
    ]
    const matches = buildCrossFileMatches(files, 'hello')
    expect(matches).toHaveLength(2)
    expect(matches[0]!.filename).toBe('src/a.ts')
    expect(matches[0]!.fileIndex).toBe(0)
    expect(matches[1]!.filename).toBe('src/b.ts')
    expect(matches[1]!.fileIndex).toBe(1)
  })

  it('is case insensitive', () => {
    const patch = '@@ -1,2 +1,2 @@\n context\n+Hello World'
    const files = [makeFile('src/app.ts', patch)]
    const matches = buildCrossFileMatches(files, 'hello')
    expect(matches).toHaveLength(1)
  })

  it('skips hunk headers', () => {
    const patch = '@@ -1,2 +1,2 @@\n context\n+added'
    const files = [makeFile('src/app.ts', patch)]
    const matches = buildCrossFileMatches(files, '@@')
    expect(matches).toHaveLength(0)
  })

  it('matches context lines', () => {
    const patch = '@@ -1,2 +1,2 @@\n context with target\n+added'
    const files = [makeFile('src/app.ts', patch)]
    const matches = buildCrossFileMatches(files, 'target')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.lineContent).toBe('context with target')
  })

  it('matches deleted lines', () => {
    const patch = '@@ -1,2 +1,2 @@\n context\n-old target line'
    const files = [makeFile('src/app.ts', patch)]
    const matches = buildCrossFileMatches(files, 'target')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.lineContent).toBe('old target line')
  })

  it('finds multiple matches in the same file', () => {
    const patch = '@@ -1,4 +1,4 @@\n first match target\n+second target here\n-third target gone\n more context'
    const files = [makeFile('src/app.ts', patch)]
    const matches = buildCrossFileMatches(files, 'target')
    expect(matches).toHaveLength(3)
  })

  it('assigns correct line indices', () => {
    const patch = '@@ -1,3 +1,3 @@\n line0\n+line1 target\n line2'
    const files = [makeFile('src/app.ts', patch)]
    const matches = buildCrossFileMatches(files, 'target')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.lineIndex).toBe(2)
  })

  it('handles files with empty patches', () => {
    const files = [
      makeFile('src/a.ts', ''),
      makeFile('src/b.ts', '@@ -1,2 +1,2 @@\n context\n+target'),
    ]
    const matches = buildCrossFileMatches(files, 'target')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.fileIndex).toBe(1)
  })

  it('handles mixed files with and without patches', () => {
    const files = [
      makeFile('src/a.ts'),
      makeFile('src/b.ts', '@@ -1,2 +1,2 @@\n context\n+target here'),
      makeFile('src/c.ts'),
    ]
    const matches = buildCrossFileMatches(files, 'target')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.fileIndex).toBe(1)
  })
})

describe('countMatchedFiles', () => {
  it('returns 0 for empty matches', () => {
    expect(countMatchedFiles([])).toBe(0)
  })

  it('counts unique files with matches', () => {
    const matches: CrossFileMatch[] = [
      { filename: 'a.ts', fileIndex: 0, lineIndex: 1, lineContent: 'foo' },
      { filename: 'a.ts', fileIndex: 0, lineIndex: 5, lineContent: 'foo' },
      { filename: 'b.ts', fileIndex: 1, lineIndex: 2, lineContent: 'foo' },
    ]
    expect(countMatchedFiles(matches)).toBe(2)
  })

  it('returns 1 when all matches are in one file', () => {
    const matches: CrossFileMatch[] = [
      { filename: 'a.ts', fileIndex: 0, lineIndex: 1, lineContent: 'foo' },
      { filename: 'a.ts', fileIndex: 0, lineIndex: 5, lineContent: 'bar' },
    ]
    expect(countMatchedFiles(matches)).toBe(1)
  })

  it('counts each unique file once', () => {
    const matches: CrossFileMatch[] = [
      { filename: 'a.ts', fileIndex: 0, lineIndex: 1, lineContent: 'x' },
      { filename: 'b.ts', fileIndex: 1, lineIndex: 2, lineContent: 'x' },
      { filename: 'c.ts', fileIndex: 2, lineIndex: 3, lineContent: 'x' },
    ]
    expect(countMatchedFiles(matches)).toBe(3)
  })
})
