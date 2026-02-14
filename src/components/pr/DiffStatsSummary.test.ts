import { describe, it, expect } from 'vitest'
import {
  computeDiffStats,
  getExtensionBreakdown,
  getTopFilesByChanges,
  formatExtensionBreakdown,
  formatTopFiles,
} from './DiffStatsSummary'
import type { FileChange } from '../../models/file-change'

function makeFile(
  filename: string,
  additions: number,
  deletions: number,
  status: FileChange['status'] = 'modified',
): FileChange {
  return {
    sha: 'abc123',
    filename,
    status,
    additions,
    deletions,
    changes: additions + deletions,
  } as unknown as FileChange
}

describe('computeDiffStats', () => {
  it('returns zero totals for empty file list', () => {
    const stats = computeDiffStats([])
    expect(stats.totalFiles).toBe(0)
    expect(stats.totalAdditions).toBe(0)
    expect(stats.totalDeletions).toBe(0)
  })

  it('sums additions and deletions across files', () => {
    const files = [
      makeFile('src/a.ts', 10, 5),
      makeFile('src/b.ts', 20, 3),
      makeFile('src/c.tsx', 5, 15),
    ]
    const stats = computeDiffStats(files)
    expect(stats.totalFiles).toBe(3)
    expect(stats.totalAdditions).toBe(35)
    expect(stats.totalDeletions).toBe(23)
  })

  it('handles single file', () => {
    const files = [makeFile('README.md', 100, 0)]
    const stats = computeDiffStats(files)
    expect(stats.totalFiles).toBe(1)
    expect(stats.totalAdditions).toBe(100)
    expect(stats.totalDeletions).toBe(0)
  })
})

describe('getExtensionBreakdown', () => {
  it('returns empty array for no files', () => {
    expect(getExtensionBreakdown([])).toEqual([])
  })

  it('groups files by extension and sorts by count descending', () => {
    const files = [
      makeFile('src/a.ts', 10, 5),
      makeFile('src/b.ts', 20, 3),
      makeFile('src/c.tsx', 5, 15),
      makeFile('src/d.ts', 1, 1),
    ]
    const breakdown = getExtensionBreakdown(files)
    expect(breakdown).toEqual([
      { ext: '.ts', count: 3 },
      { ext: '.tsx', count: 1 },
    ])
  })

  it('handles files without extension', () => {
    const files = [
      makeFile('Makefile', 10, 5),
      makeFile('Dockerfile', 3, 1),
    ]
    const breakdown = getExtensionBreakdown(files)
    expect(breakdown).toEqual([{ ext: '(no ext)', count: 2 }])
  })

  it('handles dotfiles correctly', () => {
    const files = [
      makeFile('.gitignore', 5, 0),
      makeFile('.eslintrc', 3, 2),
      makeFile('src/app.ts', 10, 5),
    ]
    const breakdown = getExtensionBreakdown(files)
    expect(breakdown).toEqual([
      { ext: '(no ext)', count: 2 },
      { ext: '.ts', count: 1 },
    ])
  })

  it('handles files with multiple dots', () => {
    const files = [
      makeFile('component.test.tsx', 10, 5),
      makeFile('utils.test.ts', 3, 2),
      makeFile('app.tsx', 1, 1),
    ]
    const breakdown = getExtensionBreakdown(files)
    expect(breakdown).toEqual([
      { ext: '.tsx', count: 2 },
      { ext: '.ts', count: 1 },
    ])
  })
})

describe('getTopFilesByChanges', () => {
  it('returns empty array for no files', () => {
    expect(getTopFilesByChanges([], 3)).toEqual([])
  })

  it('returns top N files by total changes', () => {
    const files = [
      makeFile('src/a.ts', 10, 5),
      makeFile('src/b.ts', 50, 30),
      makeFile('src/c.tsx', 5, 2),
      makeFile('src/d.ts', 100, 20),
    ]
    const top = getTopFilesByChanges(files, 3)
    expect(top).toEqual([
      { filename: 'd.ts', totalChanges: 120 },
      { filename: 'b.ts', totalChanges: 80 },
      { filename: 'a.ts', totalChanges: 15 },
    ])
  })

  it('returns all files when fewer than N', () => {
    const files = [makeFile('src/a.ts', 10, 5)]
    const top = getTopFilesByChanges(files, 3)
    expect(top).toEqual([{ filename: 'a.ts', totalChanges: 15 }])
  })

  it('uses basename for filename', () => {
    const files = [
      makeFile('src/components/layout/TopBar.tsx', 50, 10),
    ]
    const top = getTopFilesByChanges(files, 3)
    expect(top).toEqual([
      { filename: 'TopBar.tsx', totalChanges: 60 },
    ])
  })
})

describe('formatExtensionBreakdown', () => {
  it('returns empty string for empty breakdown', () => {
    expect(formatExtensionBreakdown([])).toBe('')
  })

  it('formats breakdown entries', () => {
    const breakdown = [
      { ext: '.ts', count: 12 },
      { ext: '.tsx', count: 3 },
      { ext: '.json', count: 2 },
    ]
    expect(formatExtensionBreakdown(breakdown)).toBe('12 .ts, 3 .tsx, 2 .json')
  })

  it('handles single entry', () => {
    const breakdown = [{ ext: '.ts', count: 5 }]
    expect(formatExtensionBreakdown(breakdown)).toBe('5 .ts')
  })
})

describe('formatTopFiles', () => {
  it('returns empty string for empty list', () => {
    expect(formatTopFiles([])).toBe('')
  })

  it('formats top files with change counts', () => {
    const top = [
      { filename: 'app.ts', totalChanges: 120 },
      { filename: 'utils.ts', totalChanges: 80 },
    ]
    expect(formatTopFiles(top)).toBe('app.ts (120), utils.ts (80)')
  })

  it('handles single file', () => {
    const top = [{ filename: 'index.ts', totalChanges: 50 }]
    expect(formatTopFiles(top)).toBe('index.ts (50)')
  })
})
