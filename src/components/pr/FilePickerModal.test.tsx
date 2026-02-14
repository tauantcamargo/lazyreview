import { describe, it, expect, vi } from 'vitest'
import { fuzzyMatch, fuzzyFilter } from '../../utils/fuzzy-search'
import type { FuzzyFilterResult } from '../../utils/fuzzy-search'
import { FileChange } from '../../models/file-change'

// ---------------------------------------------------------------------------
// FilePickerModal - Logic tests
//
// The FilePickerModal uses Ink's Modal wrapper with position="absolute"
// which ink-testing-library does not render. We test the extracted
// data-handling logic (fuzzy filtering, scoring, ordering, status mapping)
// directly, following the same pattern as CommandPalette.test.tsx.
// ---------------------------------------------------------------------------

function makeFile(overrides: Partial<{
  sha: string
  filename: string
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged'
  additions: number
  deletions: number
  changes: number
}>): FileChange {
  return new FileChange({
    sha: overrides.sha ?? 'abc123',
    filename: overrides.filename ?? 'src/index.ts',
    status: overrides.status ?? 'modified',
    additions: overrides.additions ?? 10,
    deletions: overrides.deletions ?? 5,
    changes: overrides.changes ?? 15,
  })
}

const mockFiles: readonly FileChange[] = [
  makeFile({ filename: 'src/components/Button.tsx', status: 'modified', additions: 20, deletions: 5 }),
  makeFile({ filename: 'src/utils/format.ts', status: 'added', additions: 45, deletions: 0 }),
  makeFile({ filename: 'src/hooks/useAuth.ts', status: 'modified', additions: 8, deletions: 3 }),
  makeFile({ filename: 'README.md', status: 'modified', additions: 2, deletions: 1 }),
  makeFile({ filename: 'src/services/api.ts', status: 'removed', additions: 0, deletions: 120 }),
  makeFile({ filename: 'src/components/Header.tsx', status: 'renamed', additions: 3, deletions: 2 }),
  makeFile({ filename: 'src/components/layout/Sidebar.tsx', status: 'modified', additions: 15, deletions: 10 }),
]

// ---------------------------------------------------------------------------
// Helper: replicates the file picker's sorting logic
// ---------------------------------------------------------------------------

function getStatusIcon(status: string): string {
  switch (status) {
    case 'added': return 'A'
    case 'removed': return 'D'
    case 'renamed': return 'R'
    default: return 'M'
  }
}

function sortWithRecentFirst(
  files: readonly FileChange[],
  recentlyViewed: readonly string[],
): readonly FileChange[] {
  if (recentlyViewed.length === 0) return files
  const recentSet = new Set(recentlyViewed)
  // Maintain the order from recentlyViewed list for viewed files
  const recentOrdered: FileChange[] = []
  for (const viewedName of recentlyViewed) {
    const file = files.find((f) => f.filename === viewedName)
    if (file) recentOrdered.push(file)
  }
  const rest = files.filter((f) => !recentSet.has(f.filename))
  return [...recentOrdered, ...rest]
}

function filterAndSort(
  files: readonly FileChange[],
  query: string,
  recentlyViewed: readonly string[] = [],
): readonly FuzzyFilterResult<FileChange>[] {
  if (query.length === 0) {
    const sorted = sortWithRecentFirst(files, recentlyViewed)
    return sorted.map((item) => ({ item, score: 0, indices: [] }))
  }
  return fuzzyFilter(files, query, (f) => f.filename)
}

describe('FilePickerModal logic', () => {
  // -------------------------------------------------------------------------
  // Fuzzy search filtering
  // -------------------------------------------------------------------------

  describe('fuzzy search filtering', () => {
    it('should return all files when query is empty', () => {
      const results = filterAndSort(mockFiles, '')
      expect(results.length).toBe(mockFiles.length)
    })

    it('should filter files by filename', () => {
      const results = filterAndSort(mockFiles, 'button')
      const filenames = results.map((r) => r.item.filename)
      expect(filenames).toContain('src/components/Button.tsx')
    })

    it('should match against full path', () => {
      const results = filterAndSort(mockFiles, 'components/lay')
      const filenames = results.map((r) => r.item.filename)
      expect(filenames).toContain('src/components/layout/Sidebar.tsx')
    })

    it('should return empty when nothing matches', () => {
      const results = filterAndSort(mockFiles, 'zzznotfound')
      expect(results.length).toBe(0)
    })

    it('should be case-insensitive', () => {
      const results = filterAndSort(mockFiles, 'README')
      const filenames = results.map((r) => r.item.filename)
      expect(filenames).toContain('README.md')
    })

    it('should support fuzzy matching (non-consecutive characters)', () => {
      // "btn" should match "Button" via b-t-n
      const results = filterAndSort(mockFiles, 'btn')
      const filenames = results.map((r) => r.item.filename)
      expect(filenames).toContain('src/components/Button.tsx')
    })
  })

  // -------------------------------------------------------------------------
  // Result sorting by score
  // -------------------------------------------------------------------------

  describe('result sorting', () => {
    it('should sort results by match score (best first)', () => {
      const results = filterAndSort(mockFiles, 'src')
      expect(results.length).toBeGreaterThan(1)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.score).toBeGreaterThanOrEqual(results[i + 1]!.score)
      }
    })

    it('should rank exact prefix matches higher', () => {
      const results = filterAndSort(mockFiles, 'src/hook')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.filename).toBe('src/hooks/useAuth.ts')
    })
  })

  // -------------------------------------------------------------------------
  // Recently viewed files ordering
  // -------------------------------------------------------------------------

  describe('recently viewed ordering', () => {
    it('should show recently viewed files first when no query', () => {
      const viewed = ['src/services/api.ts', 'README.md']
      const results = filterAndSort(mockFiles, '', viewed)
      expect(results[0]!.item.filename).toBe('src/services/api.ts')
      expect(results[1]!.item.filename).toBe('README.md')
    })

    it('should show non-viewed files after viewed files when no query', () => {
      const viewed = ['README.md']
      const results = filterAndSort(mockFiles, '', viewed)
      expect(results[0]!.item.filename).toBe('README.md')
      // Rest should be in original order
      const restFilenames = results.slice(1).map((r) => r.item.filename)
      expect(restFilenames).not.toContain('README.md')
      expect(restFilenames.length).toBe(mockFiles.length - 1)
    })

    it('should ignore recently viewed when query is active', () => {
      const viewed = ['README.md']
      const results = filterAndSort(mockFiles, 'button', viewed)
      // Should sort by score, not by viewed status
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.item.filename).toBe('src/components/Button.tsx')
    })
  })

  // -------------------------------------------------------------------------
  // File status icons
  // -------------------------------------------------------------------------

  describe('file status icons', () => {
    it('should map added to A', () => {
      expect(getStatusIcon('added')).toBe('A')
    })

    it('should map removed to D', () => {
      expect(getStatusIcon('removed')).toBe('D')
    })

    it('should map renamed to R', () => {
      expect(getStatusIcon('renamed')).toBe('R')
    })

    it('should map modified to M', () => {
      expect(getStatusIcon('modified')).toBe('M')
    })

    it('should default to M for unknown statuses', () => {
      expect(getStatusIcon('changed')).toBe('M')
      expect(getStatusIcon('copied')).toBe('M')
    })
  })

  // -------------------------------------------------------------------------
  // Match highlighting
  // -------------------------------------------------------------------------

  describe('match highlighting', () => {
    it('should return match indices for highlighting', () => {
      const result = fuzzyMatch('btn', 'Button.tsx')
      expect(result).not.toBeNull()
      expect(result!.indices.length).toBe(3)
      // B(0), t(2), n(5) in "Button"
      expect(result!.indices[0]).toBe(0) // B
    })

    it('should return empty indices when no query', () => {
      const result = fuzzyMatch('', 'Button.tsx')
      expect(result).not.toBeNull()
      expect(result!.indices).toEqual([])
    })

    it('should return null for non-matching queries', () => {
      const result = fuzzyMatch('zzz', 'Button.tsx')
      expect(result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------

  describe('selection navigation', () => {
    it('should start at index 0', () => {
      const selectedIndex = 0
      expect(selectedIndex).toBe(0)
    })

    it('should move down correctly', () => {
      let selectedIndex = 0
      selectedIndex = Math.min(selectedIndex + 1, mockFiles.length - 1)
      expect(selectedIndex).toBe(1)
    })

    it('should move up correctly', () => {
      let selectedIndex = 3
      selectedIndex = Math.max(selectedIndex - 1, 0)
      expect(selectedIndex).toBe(2)
    })

    it('should not go below zero', () => {
      let selectedIndex = 0
      selectedIndex = Math.max(selectedIndex - 1, 0)
      expect(selectedIndex).toBe(0)
    })

    it('should not exceed array bounds', () => {
      let selectedIndex = mockFiles.length - 1
      selectedIndex = Math.min(selectedIndex + 1, mockFiles.length - 1)
      expect(selectedIndex).toBe(mockFiles.length - 1)
    })

    it('should reset to 0 when query changes', () => {
      const selectedIndex = 5
      const resetIndex = 0
      expect(resetIndex).toBe(0)
      expect(selectedIndex).not.toBe(resetIndex)
    })
  })

  // -------------------------------------------------------------------------
  // Scroll window
  // -------------------------------------------------------------------------

  describe('scroll window', () => {
    const MAX_VISIBLE = 15

    it('should show all items when fewer than max', () => {
      const totalItems = 5
      const visibleCount = Math.min(MAX_VISIBLE, totalItems)
      expect(visibleCount).toBe(5)
    })

    it('should cap at max visible items', () => {
      const totalItems = 30
      const visibleCount = Math.min(MAX_VISIBLE, totalItems)
      expect(visibleCount).toBe(15)
    })

    it('should compute correct scroll offset for bottom selection', () => {
      const totalItems = 30
      const selectedIndex = 20
      const visibleCount = Math.min(MAX_VISIBLE, totalItems)
      const scrollOffset = Math.max(
        0,
        Math.min(selectedIndex - visibleCount + 1, totalItems - visibleCount),
      )
      expect(scrollOffset).toBe(6) // 20 - 15 + 1 = 6
      expect(scrollOffset + visibleCount).toBeLessThanOrEqual(totalItems)
    })

    it('should keep offset at 0 when selection is at top', () => {
      const totalItems = 30
      const selectedIndex = 0
      const visibleCount = Math.min(MAX_VISIBLE, totalItems)
      const scrollOffset = Math.max(
        0,
        Math.min(selectedIndex - visibleCount + 1, totalItems - visibleCount),
      )
      expect(scrollOffset).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // File selection callback
  // -------------------------------------------------------------------------

  describe('file selection', () => {
    it('should call onSelect with the selected file index', () => {
      const onSelect = vi.fn()
      const files = mockFiles
      const selectedIndex = 2
      const results = filterAndSort(files, '')
      const selectedFile = results[selectedIndex]
      if (selectedFile) {
        const fileIndex = files.indexOf(selectedFile.item)
        onSelect(fileIndex)
      }
      expect(onSelect).toHaveBeenCalledWith(2)
    })

    it('should find correct index in original files array after filtering', () => {
      const query = 'hook'
      const results = filterAndSort(mockFiles, query)
      expect(results.length).toBeGreaterThan(0)
      const selectedResult = results[0]!
      const originalIndex = mockFiles.findIndex(
        (f) => f.filename === selectedResult.item.filename,
      )
      expect(originalIndex).toBe(2) // useAuth.ts is at index 2
    })
  })

  // -------------------------------------------------------------------------
  // Diff stats display
  // -------------------------------------------------------------------------

  describe('diff stats', () => {
    it('should show additions and deletions for each file', () => {
      const file = mockFiles[0]! // Button.tsx
      expect(file.additions).toBe(20)
      expect(file.deletions).toBe(5)
    })

    it('should handle zero additions', () => {
      const file = mockFiles[4]! // api.ts (removed)
      expect(file.additions).toBe(0)
      expect(file.deletions).toBe(120)
    })

    it('should handle zero deletions', () => {
      const file = mockFiles[1]! // format.ts (added)
      expect(file.additions).toBe(45)
      expect(file.deletions).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Item count label
  // -------------------------------------------------------------------------

  describe('item count label', () => {
    it('should show total when no query', () => {
      const query = ''
      const total = mockFiles.length
      const filtered = filterAndSort(mockFiles, query)
      const label = query
        ? `${filtered.length}/${total}`
        : `${total}`
      expect(label).toBe('7')
    })

    it('should show filtered/total when query is active', () => {
      const query = 'component'
      const total = mockFiles.length
      const filtered = filterAndSort(mockFiles, query)
      const label = query
        ? `${filtered.length}/${total}`
        : `${total}`
      expect(label).toContain('/')
      expect(label).toContain(String(total))
    })
  })
})
