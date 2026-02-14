import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'
import { CodeReviewApi } from '../services/GitHubApi'
import { runEffect } from '../utils/effect'
import type { FileChange } from '../models/file-change'

/**
 * Threshold for switching to paginated file loading.
 * GitHub caps responses at 300 files per endpoint call.
 */
const PAGINATION_THRESHOLD = 300

interface UsePaginatedFilesOptions {
  readonly enabled?: boolean
}

interface UsePaginatedFilesResult {
  /** All files loaded so far across all pages */
  readonly files: readonly FileChange[]
  /** Whether any page is currently loading */
  readonly isLoading: boolean
  /** Whether more pages are available */
  readonly hasMoreFiles: boolean
  /** Total file count from PR metadata (if available) */
  readonly totalFileCount: number | undefined
  /** Load the next page of files */
  readonly loadNextPage: () => void
  /** Current page number */
  readonly currentPage: number
}

/**
 * Hook for loading PR files with pagination support.
 *
 * For PRs with fewer than PAGINATION_THRESHOLD files, loads all at once
 * using the existing getPRFiles endpoint.
 *
 * For PRs with PAGINATION_THRESHOLD+ files, loads one page at a time
 * using getPRFilesPage, allowing the user to load more as needed.
 */
export function usePaginatedFiles(
  owner: string,
  repo: string,
  prNumber: number,
  changedFileCount: number,
  options?: UsePaginatedFilesOptions,
): UsePaginatedFilesResult {
  const enabledFlag = options?.enabled ?? true
  const [maxPage, setMaxPage] = useState(1)

  const needsPagination = changedFileCount >= PAGINATION_THRESHOLD

  // Standard loading for small PRs (no pagination needed)
  const standardQuery = useQuery({
    queryKey: ['pr-files', owner, repo, prNumber],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRFiles(owner, repo, prNumber)
        }),
      ),
    enabled: enabledFlag && !needsPagination && !!owner && !!repo && !!prNumber,
    staleTime: 30 * 1000,
  })

  // Paginated loading for large PRs
  // We load pages 1..maxPage and merge them
  const pageQueries = usePaginatedPageQueries(
    owner,
    repo,
    prNumber,
    maxPage,
    enabledFlag && needsPagination,
  )

  const loadNextPage = useCallback(() => {
    if (needsPagination) {
      setMaxPage((prev) => prev + 1)
    }
  }, [needsPagination])

  if (!needsPagination) {
    return {
      files: standardQuery.data ?? [],
      isLoading: standardQuery.isLoading,
      hasMoreFiles: false,
      totalFileCount: undefined,
      loadNextPage,
      currentPage: 1,
    }
  }

  return {
    files: pageQueries.allFiles,
    isLoading: pageQueries.isLoading,
    hasMoreFiles: pageQueries.hasNextPage,
    totalFileCount: changedFileCount,
    loadNextPage,
    currentPage: maxPage,
  }
}

/**
 * Internal hook that manages multiple page queries for paginated file loading.
 * Loads pages 1 through maxPage and merges the results.
 */
function usePaginatedPageQueries(
  owner: string,
  repo: string,
  prNumber: number,
  maxPage: number,
  enabled: boolean,
): { readonly allFiles: readonly FileChange[]; readonly isLoading: boolean; readonly hasNextPage: boolean } {
  // Load each page individually
  const page1 = useQuery({
    queryKey: ['pr-files-page', owner, repo, prNumber, 1],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRFilesPage(owner, repo, prNumber, 1)
        }),
      ),
    enabled: enabled && !!owner && !!repo && !!prNumber,
    staleTime: 30 * 1000,
  })

  const page2 = useQuery({
    queryKey: ['pr-files-page', owner, repo, prNumber, 2],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRFilesPage(owner, repo, prNumber, 2)
        }),
      ),
    enabled: enabled && maxPage >= 2 && !!page1.data?.hasNextPage,
    staleTime: 30 * 1000,
  })

  const page3 = useQuery({
    queryKey: ['pr-files-page', owner, repo, prNumber, 3],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRFilesPage(owner, repo, prNumber, 3)
        }),
      ),
    enabled: enabled && maxPage >= 3 && !!page2.data?.hasNextPage,
    staleTime: 30 * 1000,
  })

  const page4 = useQuery({
    queryKey: ['pr-files-page', owner, repo, prNumber, 4],
    queryFn: () =>
      runEffect(
        Effect.gen(function* () {
          const api = yield* CodeReviewApi
          return yield* api.getPRFilesPage(owner, repo, prNumber, 4)
        }),
      ),
    enabled: enabled && maxPage >= 4 && !!page3.data?.hasNextPage,
    staleTime: 30 * 1000,
  })

  const pages = [page1, page2, page3, page4]

  const allFiles = useMemo(() => {
    const files: FileChange[] = []
    for (const page of pages) {
      if (page.data) {
        files.push(...page.data.items)
      }
    }
    return files
  }, [page1.data, page2.data, page3.data, page4.data])

  const isLoading = pages.some((p) => p.isLoading)

  // Determine if there are more pages available
  const lastLoadedPage = pages.filter((p) => p.data != null).length
  const hasNextPage =
    lastLoadedPage > 0 && lastLoadedPage <= pages.length
      ? pages[lastLoadedPage - 1]?.data?.hasNextPage ?? false
      : false

  return { allFiles, isLoading, hasNextPage }
}
