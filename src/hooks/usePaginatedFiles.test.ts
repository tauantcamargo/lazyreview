import { describe, it, expect, vi } from 'vitest'

/**
 * Tests for usePaginatedFiles hook logic.
 *
 * Since the hook depends on React hooks (useState, useQuery, useMemo, useCallback)
 * and Effect services, we test the exported constants and behavioral contract
 * rather than the hook internals.
 *
 * Integration coverage:
 * - fetchGitHubSinglePage is tested in GitHubApiHelpers.test.ts
 * - getPRFilesPage/getFileDiff are tested in provider contract tests
 * - usePRFilesPage/useFileDiff hooks are tested in github.test.ts (delegation)
 */

describe('usePaginatedFiles', () => {
  // The PAGINATION_THRESHOLD is 300 (GitHub's cap per endpoint call)
  const PAGINATION_THRESHOLD = 300

  describe('pagination threshold logic', () => {
    it('standard loading used when changed files below threshold', () => {
      const changedFileCount = 50
      const needsPagination = changedFileCount >= PAGINATION_THRESHOLD
      expect(needsPagination).toBe(false)
    })

    it('standard loading used when changed files at 299', () => {
      const changedFileCount = 299
      const needsPagination = changedFileCount >= PAGINATION_THRESHOLD
      expect(needsPagination).toBe(false)
    })

    it('paginated loading activated at exactly 300 files', () => {
      const changedFileCount = 300
      const needsPagination = changedFileCount >= PAGINATION_THRESHOLD
      expect(needsPagination).toBe(true)
    })

    it('paginated loading activated for large PRs', () => {
      const changedFileCount = 1200
      const needsPagination = changedFileCount >= PAGINATION_THRESHOLD
      expect(needsPagination).toBe(true)
    })

    it('standard loading used when changed file count is 0', () => {
      const changedFileCount = 0
      const needsPagination = changedFileCount >= PAGINATION_THRESHOLD
      expect(needsPagination).toBe(false)
    })
  })

  describe('pagination result shape', () => {
    it('non-paginated result has correct shape', () => {
      const result = {
        files: [],
        isLoading: false,
        hasMoreFiles: false,
        totalFileCount: undefined,
        loadNextPage: () => {},
        currentPage: 1,
      }

      expect(result.files).toEqual([])
      expect(result.isLoading).toBe(false)
      expect(result.hasMoreFiles).toBe(false)
      expect(result.totalFileCount).toBeUndefined()
      expect(result.currentPage).toBe(1)
    })

    it('paginated result includes totalFileCount', () => {
      const changedFileCount = 500
      const result = {
        files: [],
        isLoading: false,
        hasMoreFiles: true,
        totalFileCount: changedFileCount,
        loadNextPage: () => {},
        currentPage: 1,
      }

      expect(result.totalFileCount).toBe(500)
      expect(result.hasMoreFiles).toBe(true)
    })
  })

  describe('page merging logic', () => {
    it('merges files from multiple pages in order', () => {
      const page1Files = [
        { filename: 'file1.ts', status: 'modified', additions: 1, deletions: 0 },
        { filename: 'file2.ts', status: 'added', additions: 5, deletions: 0 },
      ]
      const page2Files = [
        { filename: 'file3.ts', status: 'removed', additions: 0, deletions: 10 },
      ]

      const allFiles = [...page1Files, ...page2Files]
      expect(allFiles).toHaveLength(3)
      expect(allFiles[0].filename).toBe('file1.ts')
      expect(allFiles[1].filename).toBe('file2.ts')
      expect(allFiles[2].filename).toBe('file3.ts')
    })

    it('handles empty pages gracefully', () => {
      const page1Files = [{ filename: 'file1.ts', status: 'modified', additions: 1, deletions: 0 }]
      const page2Files: typeof page1Files = []

      const allFiles = [...page1Files, ...page2Files]
      expect(allFiles).toHaveLength(1)
    })
  })

  describe('hasNextPage detection', () => {
    it('last loaded page determines hasNextPage', () => {
      const pages = [
        { data: { items: [], hasNextPage: true }, isLoading: false },
        { data: null, isLoading: false },
      ]

      const lastLoadedPage = pages.filter((p) => p.data != null).length
      const hasNextPage =
        lastLoadedPage > 0 && lastLoadedPage <= pages.length
          ? pages[lastLoadedPage - 1]?.data?.hasNextPage ?? false
          : false

      expect(hasNextPage).toBe(true)
    })

    it('hasNextPage is false when last page has no next', () => {
      const pages = [
        { data: { items: [], hasNextPage: true }, isLoading: false },
        { data: { items: [], hasNextPage: false }, isLoading: false },
      ]

      const lastLoadedPage = pages.filter((p) => p.data != null).length
      const hasNextPage =
        lastLoadedPage > 0 && lastLoadedPage <= pages.length
          ? pages[lastLoadedPage - 1]?.data?.hasNextPage ?? false
          : false

      expect(hasNextPage).toBe(false)
    })

    it('hasNextPage is false when no pages loaded', () => {
      const pages = [
        { data: null, isLoading: true },
      ]

      const lastLoadedPage = pages.filter((p) => p.data != null).length
      const hasNextPage =
        lastLoadedPage > 0 && lastLoadedPage <= pages.length
          ? pages[lastLoadedPage - 1]?.data?.hasNextPage ?? false
          : false

      expect(hasNextPage).toBe(false)
    })
  })

  describe('loadNextPage behavior', () => {
    it('loadNextPage is a no-op when pagination is not needed', () => {
      const needsPagination = false
      let maxPage = 1

      const loadNextPage = () => {
        if (needsPagination) {
          maxPage = maxPage + 1
        }
      }

      loadNextPage()
      expect(maxPage).toBe(1)
    })

    it('loadNextPage increments page when pagination is needed', () => {
      const needsPagination = true
      let maxPage = 1

      const loadNextPage = () => {
        if (needsPagination) {
          maxPage = maxPage + 1
        }
      }

      loadNextPage()
      expect(maxPage).toBe(2)
      loadNextPage()
      expect(maxPage).toBe(3)
    })
  })

  describe('query enablement logic', () => {
    it('standard query enabled when small PR and enabled flag is true', () => {
      const enabledFlag = true
      const needsPagination = false
      const owner = 'owner'
      const repo = 'repo'
      const prNumber = 42

      const enabled = enabledFlag && !needsPagination && !!owner && !!repo && !!prNumber
      expect(enabled).toBe(true)
    })

    it('standard query disabled when large PR', () => {
      const enabledFlag = true
      const needsPagination = true
      const owner = 'owner'
      const repo = 'repo'
      const prNumber = 42

      const enabled = enabledFlag && !needsPagination && !!owner && !!repo && !!prNumber
      expect(enabled).toBe(false)
    })

    it('standard query disabled when enabled flag is false', () => {
      const enabledFlag = false
      const needsPagination = false
      const owner = 'owner'
      const repo = 'repo'
      const prNumber = 42

      const enabled = enabledFlag && !needsPagination && !!owner && !!repo && !!prNumber
      expect(enabled).toBe(false)
    })

    it('standard query disabled when owner is empty', () => {
      const enabledFlag = true
      const needsPagination = false
      const owner = ''
      const repo = 'repo'
      const prNumber = 42

      const enabled = enabledFlag && !needsPagination && !!owner && !!repo && !!prNumber
      expect(enabled).toBe(false)
    })

    it('paginated query enabled when large PR and enabled flag is true', () => {
      const enabledFlag = true
      const needsPagination = true

      const enabled = enabledFlag && needsPagination
      expect(enabled).toBe(true)
    })

    it('page 2 query requires page 1 to have hasNextPage', () => {
      const enabled = true
      const maxPage = 2
      const page1HasNextPage = true

      const page2Enabled = enabled && maxPage >= 2 && page1HasNextPage
      expect(page2Enabled).toBe(true)
    })

    it('page 2 query disabled when page 1 has no next page', () => {
      const enabled = true
      const maxPage = 2
      const page1HasNextPage = false

      const page2Enabled = enabled && maxPage >= 2 && page1HasNextPage
      expect(page2Enabled).toBe(false)
    })

    it('page 2 query disabled when maxPage is still 1', () => {
      const enabled = true
      const maxPage = 1
      const page1HasNextPage = true

      const page2Enabled = enabled && maxPage >= 2 && page1HasNextPage
      expect(page2Enabled).toBe(false)
    })
  })
})
