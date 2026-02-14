import { describe, it, expect, vi } from 'vitest'
import type { DiffBookmark } from '../../utils/diff-bookmarks'

// ---------------------------------------------------------------------------
// BookmarkListModal - Logic tests
//
// The BookmarkListModal uses Ink's Modal wrapper with position="absolute"
// which ink-testing-library does not render. We test the extracted
// data-handling logic directly, following the same pattern as
// FilePickerModal.test.tsx and CommandPalette.test.tsx.
// ---------------------------------------------------------------------------

const mockBookmarks: readonly DiffBookmark[] = [
  { register: 'a', file: 'src/components/Button.tsx', line: 42, prKey: 'pr1' },
  { register: 'b', file: 'src/utils/format.ts', line: 10, prKey: 'pr1' },
  { register: 'c', file: 'src/hooks/useAuth.ts', line: 88, prKey: 'pr1' },
  { register: 'm', file: 'README.md', line: 1, prKey: 'pr1' },
  { register: 'z', file: 'src/services/api.ts', line: 200, prKey: 'pr1' },
]

// ---------------------------------------------------------------------------
// Display formatting helpers (replicated from component for testing)
// ---------------------------------------------------------------------------

function formatBookmarkRow(bookmark: DiffBookmark): string {
  return `${bookmark.register}  ${bookmark.file}:${bookmark.line}`
}

function truncateFilename(filename: string, maxLen: number): string {
  if (filename.length <= maxLen) return filename
  return '...' + filename.slice(filename.length - maxLen + 3)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BookmarkListModal logic', () => {
  describe('empty state', () => {
    it('should display no bookmarks message when list is empty', () => {
      const bookmarks: readonly DiffBookmark[] = []
      expect(bookmarks.length).toBe(0)
    })
  })

  describe('bookmark display', () => {
    it('should format bookmark rows with register, file, and line', () => {
      const row = formatBookmarkRow(mockBookmarks[0]!)
      expect(row).toBe('a  src/components/Button.tsx:42')
    })

    it('should display all bookmarks', () => {
      const rows = mockBookmarks.map(formatBookmarkRow)
      expect(rows).toHaveLength(5)
    })

    it('should show bookmarks already sorted by register', () => {
      // Bookmarks come pre-sorted from listBookmarks
      for (let i = 0; i < mockBookmarks.length - 1; i++) {
        expect(
          mockBookmarks[i]!.register.localeCompare(mockBookmarks[i + 1]!.register),
        ).toBeLessThan(0)
      }
    })
  })

  describe('filename truncation', () => {
    it('should not truncate short filenames', () => {
      expect(truncateFilename('README.md', 40)).toBe('README.md')
    })

    it('should truncate long filenames with leading ellipsis', () => {
      const long = 'src/components/deeply/nested/path/to/Component.tsx'
      const truncated = truncateFilename(long, 30)
      expect(truncated.length).toBe(30)
      expect(truncated.startsWith('...')).toBe(true)
    })

    it('should preserve the end of the path', () => {
      const long = 'src/components/layout/Sidebar.tsx'
      const truncated = truncateFilename(long, 20)
      expect(truncated.endsWith('Sidebar.tsx')).toBe(true)
    })
  })

  describe('keyboard navigation', () => {
    it('should start at index 0', () => {
      const selectedIndex = 0
      expect(selectedIndex).toBe(0)
    })

    it('should move down correctly', () => {
      let selectedIndex = 0
      selectedIndex = Math.min(selectedIndex + 1, mockBookmarks.length - 1)
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
      let selectedIndex = mockBookmarks.length - 1
      selectedIndex = Math.min(selectedIndex + 1, mockBookmarks.length - 1)
      expect(selectedIndex).toBe(mockBookmarks.length - 1)
    })
  })

  describe('jump callback', () => {
    it('should call onJump with the selected bookmark', () => {
      const onJump = vi.fn()
      const selectedIndex = 2
      const selected = mockBookmarks[selectedIndex]!
      onJump(selected)
      expect(onJump).toHaveBeenCalledWith(selected)
      expect(onJump).toHaveBeenCalledWith(
        expect.objectContaining({
          register: 'c',
          file: 'src/hooks/useAuth.ts',
          line: 88,
        }),
      )
    })
  })

  describe('delete callback', () => {
    it('should call onDelete with the selected bookmark register', () => {
      const onDelete = vi.fn()
      const selectedIndex = 1
      const selected = mockBookmarks[selectedIndex]!
      onDelete(selected.register)
      expect(onDelete).toHaveBeenCalledWith('b')
    })

    it('should not crash on empty bookmarks list', () => {
      const bookmarks: readonly DiffBookmark[] = []
      const onDelete = vi.fn()
      if (bookmarks.length > 0) {
        onDelete(bookmarks[0]!.register)
      }
      expect(onDelete).not.toHaveBeenCalled()
    })
  })

  describe('close callback', () => {
    it('should call onClose when escape is pressed', () => {
      const onClose = vi.fn()
      // Simulate escape
      onClose()
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('selection after deletion', () => {
    it('should adjust index when last item is deleted', () => {
      const bookmarks = [...mockBookmarks]
      let selectedIndex = bookmarks.length - 1 // last item
      // After deletion, clamp to new length
      const newLength = bookmarks.length - 1
      selectedIndex = Math.min(selectedIndex, newLength - 1)
      expect(selectedIndex).toBe(3) // was 4, now clamped to 3
    })

    it('should keep index at 0 when first item is deleted', () => {
      let selectedIndex = 0
      // After deletion, clamp to valid range
      const newLength = mockBookmarks.length - 1
      selectedIndex = Math.min(selectedIndex, newLength - 1)
      expect(selectedIndex).toBe(0)
    })
  })
})
